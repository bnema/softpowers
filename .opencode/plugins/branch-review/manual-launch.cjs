const { spawn, spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const readline = require("node:readline")
const { parseArgs } = require("./launch-shared.cjs")

const args = parseArgs()

const session = args.get("session")

if (!session) {
  process.stderr.write("session is required\n")
  process.exit(1)
}

const opencodeUrl = args.get("opencode-url") || process.env.OPENCODE_API_URL || null
const urlFile = args.get("url-file") || null

const reviewServerPath = args.get("review-server-path") || path.join(__dirname, "server.cjs")
const repo = args.get("repo") || process.env.SUPERPOWERS_REVIEW_REPO || process.cwd()
const base = args.get("base") || process.env.SUPERPOWERS_REVIEW_BASE || "main"
const promptTimeoutMs = Number.parseInt(
  args.get("prompt-timeout-ms") || process.env.SUPERPOWERS_REVIEW_PROMPT_TIMEOUT_MS || "15000",
  10,
)

function getPromptTimeoutMs() {
  return Number.isFinite(promptTimeoutMs) && promptTimeoutMs > 0 ? promptTimeoutMs : 15000
}

async function loadReviewPrompt() {
  const source = fs.readFileSync(path.join(__dirname, "review-prompt.js"), "utf8")
  const module = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`)
  return module.formatReviewPrompt
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

async function main() {
  const formatReviewPrompt = await loadReviewPrompt()
  const child = spawn(process.execPath, [reviewServerPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SUPERPOWERS_REVIEW_REPO: repo,
      SUPERPOWERS_REVIEW_BASE: base,
      SUPERPOWERS_REVIEW_SESSION: session,
    },
    stdio: ["ignore", "pipe", "pipe"],
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

  async function submitPrompt(text) {
    const timeoutMs = getPromptTimeoutMs()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${opencodeUrl.replace(/\/$/, "")}/session/${session}/prompt_async`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
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

  const stopChild = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return
    child.kill()
    await waitForExit(child)
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
        const sessionUrl = new URL(`http://127.0.0.1:${event.port}/`)
        sessionUrl.searchParams.set("session", session)
        sessionUrl.searchParams.set("base", base)
        if (urlFile) {
          fs.mkdirSync(path.dirname(urlFile), { recursive: true })
          fs.writeFileSync(urlFile, sessionUrl.toString())
        }
        process.stdout.write(`Open ${sessionUrl.toString()}\n`)
        return
      }

      if (event.type !== "review-submitted" || shuttingDown) return

      shuttingDown = true
      void (async () => {
        try {
          const text = formatReviewPrompt(event.payload)

          if (opencodeUrl) {
            await submitPrompt(text)
          } else {
            const result = spawnSync("opencode", ["run", "-s", session, "--dir", repo, text], {
              cwd: process.cwd(),
              stdio: "ignore",
            })

            if (result.error) throw result.error
            if (result.status !== 0) throw new Error(`opencode exited with ${result.status ?? result.signal}`)
          }

          await stopChild()
          finish(resolve)
        } catch (error) {
          try {
            await stopChild()
          } catch {}
          finish(reject, error)
        }
      })()
    })
  })
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
