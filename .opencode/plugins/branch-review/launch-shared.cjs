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
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "superpowers", "branch-review")
}

function defaultStateFile() {
  return path.join(cacheDir(), "review-bridge-state.json")
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

function removeIfExists(filePath) {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {}
}

module.exports = {
  cacheDir,
  defaultStateFile,
  isProcessAlive,
  parseArgs,
  readJson,
  removeIfExists,
  sleep,
}
