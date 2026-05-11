const { spawn, spawnSync } = require("node:child_process")
const fs = require("node:fs")
const readline = require("node:readline")
const { pathToFileURL } = require("node:url")
const { parseArgs } = require("./launch-shared.cjs")

const args = parseArgs()
const session = args.get("session")

if (!session) {
  process.stderr.write("session is required\n")
  process.exit(1)
}

const opencodeUrl = args.get("opencode-url") || process.env.OPENCODE_API_URL || null
const urlFile = args.get("url-file") || null
const reviewServerPath = args.get("review-server-path") || require.resolve("local-pr-review-server/server.cjs")
const reviewAdapterPath = args.get("review-adapter-path") || require.resolve("local-pr-review-server/opencode.js")
const repo = args.get("repo") || process.cwd()
const base = args.get("base") || "main"
const promptTimeoutMs = Number.parseInt(
  args.get("prompt-timeout-ms") || process.env.SOFTPOWERS_REVIEW_PROMPT_TIMEOUT_MS || "15000",
  10,
)
const shutdownTimeoutMs = Number.parseInt(
  args.get("shutdown-timeout-ms") || process.env.SOFTPOWERS_REVIEW_SHUTDOWN_TIMEOUT_MS || "250",
  10,
)

function getPromptTimeoutMs() {
  return Number.isFinite(promptTimeoutMs) && promptTimeoutMs > 0 ? promptTimeoutMs : 15000
}

function getShutdownTimeoutMs() {
  return Number.isFinite(shutdownTimeoutMs) && shutdownTimeoutMs > 0 ? shutdownTimeoutMs : 250
}

async function loadReviewAdapter() {
  const module = await import(pathToFileURL(reviewAdapterPath).href)
  if (module.default && typeof module.default === "object") {
    return { ...module.default, ...module }
  }
  return module
}

async function waitForExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve()
      return
    }

    child.once("exit", resolve)
  })
}

async function shutdownChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return

  const exited = await Promise.race([
    waitForExit(child).then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), getShutdownTimeoutMs())),
  ])

  if (exited) return

  child.kill("SIGTERM")
  await waitForExit(child)
}

async function main() {
  const { formatReviewPrompt, buildOpenCodeReviewUrl } = await loadReviewAdapter()
  const child = spawn(process.execPath, [reviewServerPath], {
    cwd: repo,
    env: {
      ...process.env,
      LOCAL_PR_REVIEW_REPO: repo,
      LOCAL_PR_REVIEW_BASE: base,
      LOCAL_PR_REVIEW_CONTEXT_ID: session,
    },
    stdio: ["pipe", "pipe", "pipe"],
  })

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk)
  })

  const rl = readline.createInterface({ input: child.stdout })
  let settled = false
  let shuttingDown = false

  const finish = (fn, value) => {
    if (settled) return
    settled = true
    rl.close()
    fn(value)
  }

  function sendSubmissionAck(requestId, ack) {
    if (!child.stdin || child.stdin.destroyed) {
      throw new Error("review server stdin is closed")
    }

    const submissionAck = { type: "review-ack", requestId, ok: ack.ok }
    if (ack.ok) submissionAck.message = ack.message
    else submissionAck.error = ack.error

    child.stdin.write(JSON.stringify(submissionAck) + "\n")
  }

  async function submitPrompt(text) {
    const timeoutMs = getPromptTimeoutMs()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${opencodeUrl.replace(/\/$/, "")}/session/${session}/prompt_async`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          directory: repo,
          noReply: false,
          parts: [{ type: "text", text }],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`prompt_async failed with ${response.status}`)
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`prompt_async timed out after ${timeoutMs}ms`)
      }

      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  await new Promise((resolve, reject) => {
    child.once("error", (error) => {
      if (settled) return
      finish(reject, error)
    })

    child.once("exit", (code, signal) => {
      if (settled || shuttingDown) return
      finish(reject, new Error(`review server exited with ${code ?? signal}`))
    })

    rl.on("line", (line) => {
      let event
      try {
        event = JSON.parse(line)
      } catch {
        return
      }

      if (event.type === "server-started" && event.port != null) {
        const sessionUrl = buildOpenCodeReviewUrl(event, { sessionID: session, baseRef: base })
        if (urlFile) {
          fs.mkdirSync(require("node:path").dirname(urlFile), { recursive: true })
          fs.writeFileSync(urlFile, sessionUrl)
        }
        process.stdout.write(`Open ${sessionUrl}\n`)
        return
      }

      if (event.type !== "review-submitted" || shuttingDown) return
      if (!event.requestId) {
        shuttingDown = true
        finish(reject, new Error("review submission is missing a request id"))
        return
      }

      shuttingDown = true
      void (async () => {
        let ack = { ok: true, message: "Review delivered to OpenCode" }

        try {
          const text = formatReviewPrompt(event.payload)

          if (opencodeUrl) {
            await submitPrompt(text)
            ack = { ok: true, message: "Review delivered to OpenCode session" }
          } else {
            const result = spawnSync("opencode", ["run", "-s", session, "--dir", repo, text], {
              cwd: process.cwd(),
              encoding: "utf8",
            })

            const stderr = result.stderr?.toString().trim()
            const stdout = result.stdout?.toString().trim()
            const output = [stderr && `stderr:\n${stderr}`, stdout && `stdout:\n${stdout}`].filter(Boolean).join("\n")

            if (result.error) {
              const error = result.error instanceof Error ? result.error : new Error(String(result.error))
              if (output) error.message = `${error.message}\n${output}`
              throw error
            }

            if (result.status !== 0) {
              throw new Error(`opencode exited with ${result.status ?? result.signal}${output ? `\n${output}` : ""}`)
            }

            ack = { ok: true, message: "Review delivered via opencode CLI" }
          }
        } catch (error) {
          ack = { ok: false, error: error instanceof Error ? error.message : String(error) }
        }

        try {
          sendSubmissionAck(event.requestId, ack)
        } catch (error) {
          ack = { ok: false, error: error instanceof Error ? error.message : String(error) }
        }

        try {
          if (child.stdin && !child.stdin.destroyed) child.stdin.end()
        } catch {}

        try {
          await shutdownChild(child)
        } catch {}

        if (ack.ok) {
          finish(resolve)
          return
        }

        finish(reject, new Error(ack.error || "failed to submit review"))
      })()
    })
  })
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
