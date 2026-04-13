const { spawn } = require("node:child_process")
const path = require("node:path")
const fs = require("node:fs")
const {
  defaultStateFile,
  isProcessAlive,
  killProcessTree,
  listSessionStateFiles,
  parseArgs,
  readJson,
  removeStateArtifacts,
  sessionStateFile,
  sleep,
} = require("./launch-shared.cjs")

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

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return
    await sleep(25)
  }

  throw new Error(`review bridge pid ${pid} did not exit after SIGTERM`)
}

async function replaceSameSessionBridge(session) {
  for (const filePath of listSessionStateFiles()) {
    const state = readJson(filePath)
    if (!state) {
      removeStateArtifacts(filePath)
      continue
    }

    const pid = Number.parseInt(String(state.pid), 10)
    if (!isProcessAlive(pid)) {
      removeStateArtifacts(filePath, state)
      continue
    }

    if (state.session !== session) continue

    killProcessTree(pid, "SIGTERM")
    await waitForExit(pid, 5000)
    removeStateArtifacts(filePath, state)
  }
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
  const explicitStateFile = args.get("state-file") || null
  const stateFile = explicitStateFile || sessionStateFile(session)
  const aliasStateFile = defaultStateFile()
  const launcherPath = args.get("launcher-path") || path.join(__dirname, "manual-launch.cjs")
  const urlFile = `${stateFile}.url`
  const stdoutLog = `${stateFile}.stdout.log`
  const stderrLog = `${stateFile}.stderr.log`

  fs.mkdirSync(path.dirname(stateFile), { recursive: true })

  if (!explicitStateFile) {
    await replaceSameSessionBridge(session)
  }

  const currentState = readJson(stateFile)
  if (currentState) {
    const currentPid = Number.parseInt(String(currentState.pid), 10)
    if (isProcessAlive(currentPid)) {
      process.stderr.write(`review bridge already running (pid ${currentPid})\n`)
      process.exit(1)
    }

    removeStateArtifacts(stateFile, currentState)
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
    if (!explicitStateFile) {
      fs.writeFileSync(aliasStateFile, `${JSON.stringify(state, null, 2)}\n`)
    }
    process.stdout.write(`${url}\n`)
  } catch (error) {
    if (child?.pid) {
      try {
        killProcessTree(child.pid, "SIGTERM")
      } catch {}
    }

    removeStateArtifacts(stateFile)
    if (!explicitStateFile) removeStateArtifacts(aliasStateFile)
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
