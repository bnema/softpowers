const { spawn } = require("node:child_process")
const path = require("node:path")
const fs = require("node:fs")
const { defaultStateFile, isProcessAlive, parseArgs, readJson, removeIfExists, sleep } = require("./launch-shared.cjs")

async function waitForUrlFile(urlFile, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (fs.existsSync(urlFile)) {
      const url = fs.readFileSync(urlFile, "utf8").trim()
      if (url) return url
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("manual review launcher exited before writing the url")
    }

    await sleep(25)
  }

  throw new Error("timed out waiting for review url")
}

async function main() {
  const args = parseArgs()
  const session = args.get("session")

  if (!session) {
    process.stderr.write("session is required\n")
    process.exit(1)
  }

  const base = args.get("base") || process.env.SUPERPOWERS_REVIEW_BASE || "main"
  const repo = args.get("repo") || process.env.SUPERPOWERS_REVIEW_REPO || process.cwd()
  const stateFile = args.get("state-file") || defaultStateFile()
  const launcherPath = args.get("launcher-path") || path.join(__dirname, "manual-launch.cjs")
  const urlFile = `${stateFile}.url`
  const stdoutLog = `${stateFile}.stdout.log`
  const stderrLog = `${stateFile}.stderr.log`

  fs.mkdirSync(path.dirname(stateFile), { recursive: true })

  const currentState = readJson(stateFile)
  if (currentState) {
    const currentPid = Number.parseInt(String(currentState.pid), 10)
    if (isProcessAlive(currentPid)) {
      process.stderr.write(`review bridge already running (pid ${currentPid})\n`)
      process.exit(1)
    }

    removeIfExists(currentState.urlFile || urlFile)
    removeIfExists(stateFile)
  }

  const stdoutFd = fs.openSync(stdoutLog, "w")
  const stderrFd = fs.openSync(stderrLog, "w")
  let child

  try {
    child = spawn(process.execPath, [launcherPath, "--session", session, "--base", base, "--repo", repo, "--url-file", urlFile], {
      cwd: repo,
      detached: true,
      env: {
        ...process.env,
        SUPERPOWERS_REVIEW_BASE: base,
        SUPERPOWERS_REVIEW_REPO: repo,
        SUPERPOWERS_REVIEW_SESSION: session,
      },
      stdio: ["ignore", stdoutFd, stderrFd],
    })

    child.unref()

    const url = await waitForUrlFile(urlFile, child, 5000)
    const state = {
      pid: child.pid,
      session,
      base,
      repo,
      url,
      urlFile,
      stdoutLog,
      stderrLog,
    }

    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`)
    process.stdout.write(`${url}\n`)
  } catch (error) {
    if (child?.pid) {
      try {
        process.kill(child.pid, "SIGTERM")
      } catch {}
    }

    removeIfExists(urlFile)
    removeIfExists(stateFile)
    throw error
  } finally {
    fs.closeSync(stdoutFd)
    fs.closeSync(stderrFd)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
