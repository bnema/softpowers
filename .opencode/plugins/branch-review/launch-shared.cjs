const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

function parseArgs() {
  const args = new Map()

  for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i]
    const value = process.argv[i + 1]
    if (flag && flag.startsWith("--") && value !== undefined) {
      args.set(flag.slice(2), value)
    }
  }

  return args
}

function cacheDir() {
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "softpowers", "branch-review")
}

function defaultStateFile() {
  return path.join(cacheDir(), "review-bridge-state.json")
}

function sessionStateFile(session) {
  const safeSession = String(session || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_")
  return path.join(cacheDir(), `review-bridge-${safeSession}.json`)
}

function listSessionStateFiles() {
  try {
    return fs
      .readdirSync(cacheDir())
      .filter((name) => name.startsWith("review-bridge-") && name.endsWith(".json") && name !== "review-bridge-state.json")
      .map((name) => path.join(cacheDir(), name))
  } catch {
    return []
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error && error.code !== "ESRCH"
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return
    await sleep(25)
  }

  throw new Error(`review bridge pid ${pid} did not exit after SIGTERM`)
}

function removeIfExists(filePath) {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {}
}

function removeStateArtifacts(stateFile, state = readJson(stateFile)) {
  if (state?.urlFile) removeIfExists(state.urlFile)
  if (state?.stdoutLog) removeIfExists(state.stdoutLog)
  if (state?.stderrLog) removeIfExists(state.stderrLog)
  removeIfExists(stateFile)
}

function killProcessTree(pid, signal = "SIGTERM") {
  if (!Number.isInteger(pid) || pid <= 0) return

  try {
    process.kill(-pid, signal)
    return
  } catch (error) {
    if (error?.code !== "ESRCH") {
      try {
        process.kill(pid, signal)
        return
      } catch {}
    }
  }

  try {
    process.kill(pid, signal)
  } catch {}
}

module.exports = {
  cacheDir,
  defaultStateFile,
  isProcessAlive,
  killProcessTree,
  listSessionStateFiles,
  parseArgs,
  readJson,
  removeIfExists,
  removeStateArtifacts,
  sessionStateFile,
  sleep,
  waitForExit,
}
