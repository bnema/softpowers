import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function reviewStartPath() {
  return path.join(process.cwd(), ".opencode/plugins/branch-review/review-start.cjs")
}

function reviewStopPath() {
  return path.join(process.cwd(), ".opencode/plugins/branch-review/review-stop.cjs")
}

function skillReviewStartPath() {
  return path.join(process.cwd(), "skills/local-branch-review/review-start.cjs")
}

function skillReviewStopPath() {
  return path.join(process.cwd(), "skills/local-branch-review/review-stop.cjs")
}

function cacheStateDir(cacheHome) {
  return path.join(cacheHome, "softpowers", "branch-review")
}

function sessionStateFile(cacheHome, session) {
  const safeSession = String(session).replace(/[^a-zA-Z0-9_-]/g, "_")
  return path.join(cacheStateDir(cacheHome), `review-bridge-${safeSession}.json`)
}

function defaultAliasStateFile(cacheHome) {
  return path.join(cacheStateDir(cacheHome), "review-bridge-state.json")
}

async function waitForFile(filePath, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`timed out waiting for ${path.basename(filePath)}`)
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function createFakeLauncherScript(dir) {
  const scriptPath = path.join(dir, "fake-launcher.cjs")
  fs.writeFileSync(
    scriptPath,
    `const fs = require("node:fs")
const path = require("node:path")

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i]
  const value = process.argv[i + 1]
  if (flag && flag.startsWith("--") && value !== undefined) args.set(flag.slice(2), value)
}

const urlFile = args.get("url-file")
const session = args.get("session") || ""
const base = args.get("base") || "main"
const url = "http://127.0.0.1:4321/?session=" + encodeURIComponent(session) + "&base=" + encodeURIComponent(base)

if (process.env.FAKE_LAUNCHER_MARKER) {
  fs.writeFileSync(process.env.FAKE_LAUNCHER_MARKER, JSON.stringify({ argv: process.argv.slice(2), pid: process.pid }))
}

if (urlFile) {
  fs.mkdirSync(path.dirname(urlFile), { recursive: true })
  fs.writeFileSync(urlFile, url)
}

process.on("SIGTERM", () => {
  if (process.env.FAKE_LAUNCHER_STOP_MARKER) {
    fs.writeFileSync(process.env.FAKE_LAUNCHER_STOP_MARKER, "stopped\\n")
  }
  process.exit(0)
})

setInterval(() => {}, 1000)
`,
  )
  fs.chmodSync(scriptPath, 0o755)
  return scriptPath
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function startReviewStart(args, env = {}) {
  return spawnSync(process.execPath, [reviewStartPath(), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, ...env },
  })
}

function cleanupReviewLaunchArtifacts({ tempDir, stateFile, markerFile }) {
  try {
    if (fs.existsSync(stateFile)) {
      spawnSync(process.execPath, [reviewStopPath(), "--state-file", stateFile], {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 10000,
      })
    } else if (markerFile && fs.existsSync(markerFile)) {
      try {
        const marker = readJson(markerFile)
        if (typeof marker.pid === "number" && isProcessAlive(marker.pid)) {
          process.kill(marker.pid)
        }
      } catch {
        // best-effort cleanup
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

test("review start requires a session", () => {
  const result = startReviewStart([])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /session is required/)
})

test("skill wrapper resolves the review launcher relative to the skill directory", () => {
  const tempDir = makeTempDir("softpowers-review-skill-")
  const launcherPath = createFakeLauncherScript(tempDir)
  const stateFile = path.join(tempDir, "state.json")
  const repoDir = path.join(tempDir, "repo")
  const randomCwd = path.join(tempDir, "not-the-repo")
  fs.mkdirSync(repoDir)
  fs.mkdirSync(randomCwd)

  const start = spawnSync(process.execPath, [skillReviewStartPath(), "--session", "ses_skill", "--base", "main", "--repo", repoDir, "--state-file", stateFile, "--launcher-path", launcherPath], {
    cwd: randomCwd,
    encoding: "utf8",
    timeout: 10000,
  })

  assert.equal(start.status, 0)
  assert.equal(start.stderr, "")
  assert.equal(start.stdout.trim(), "http://127.0.0.1:4321/?session=ses_skill&base=main")

  const state = readJson(stateFile)
  assert.equal(state.repo, repoDir)
  assert.ok(isProcessAlive(state.pid))

  const stop = spawnSync(process.execPath, [skillReviewStopPath(), "--state-file", stateFile], {
    cwd: randomCwd,
    encoding: "utf8",
    timeout: 10000,
  })

  assert.equal(stop.status, 0)
  assert.match(stop.stdout, /stopped review bridge/)
  assert.equal(fs.existsSync(stateFile), false)

  fs.rmSync(tempDir, { recursive: true, force: true })
})

test("review start prints the url and writes state", (t) => {
  const tempDir = makeTempDir("softpowers-review-launch-")
  const launcherPath = createFakeLauncherScript(tempDir)
  const stateFile = path.join(tempDir, "state.json")
  const markerFile = path.join(tempDir, "launch-marker.json")
  const stopMarkerFile = path.join(tempDir, "stop-marker.txt")
  const repoDir = path.join(tempDir, "repo")
  fs.mkdirSync(repoDir)

  t.after(() => {
    cleanupReviewLaunchArtifacts({ tempDir, stateFile, markerFile })
    assert.equal(fs.existsSync(stateFile), false)
    assert.equal(fs.existsSync(markerFile), false)
    assert.equal(fs.existsSync(stopMarkerFile), false)
    assert.equal(fs.existsSync(tempDir), false)
  })

  const result = startReviewStart(
    ["--session", "ses_123", "--base", "main", "--repo", repoDir, "--state-file", stateFile, "--launcher-path", launcherPath],
    { FAKE_LAUNCHER_MARKER: markerFile, FAKE_LAUNCHER_STOP_MARKER: stopMarkerFile },
  )

  assert.equal(result.status, 0)
  assert.equal(result.stderr, "")
  assert.equal(result.stdout.trim(), "http://127.0.0.1:4321/?session=ses_123&base=main")

  const state = readJson(stateFile)
  assert.equal(state.session, "ses_123")
  assert.equal(state.base, "main")
  assert.equal(state.repo, repoDir)
  assert.equal(state.url, "http://127.0.0.1:4321/?session=ses_123&base=main")
  assert.equal(typeof state.pid, "number")
  assert.ok(fs.existsSync(state.stdoutLog))
  assert.ok(fs.existsSync(state.stderrLog))
  assert.ok(fs.existsSync(state.urlFile))
  assert.equal(fs.readFileSync(state.urlFile, "utf8"), state.url)
  assert.ok(isProcessAlive(state.pid))
  assert.ok(fs.existsSync(markerFile))
  assert.equal(fs.existsSync(stopMarkerFile), false)
})

test("review stop kills the process and removes state", async (t) => {
  const tempDir = makeTempDir("softpowers-review-launch-")
  const launcherPath = createFakeLauncherScript(tempDir)
  const stateFile = path.join(tempDir, "state.json")
  const stopMarkerFile = path.join(tempDir, "stop-marker.txt")
  const repoDir = path.join(tempDir, "repo")
  fs.mkdirSync(repoDir)

  t.after(() => {
    cleanupReviewLaunchArtifacts({ tempDir, stateFile })
    assert.equal(fs.existsSync(stateFile), false)
    assert.equal(fs.existsSync(stopMarkerFile), false)
    assert.equal(fs.existsSync(tempDir), false)
  })

  const start = startReviewStart(
    ["--session", "ses_456", "--base", "main", "--repo", repoDir, "--state-file", stateFile, "--launcher-path", launcherPath],
    { FAKE_LAUNCHER_STOP_MARKER: stopMarkerFile },
  )
  assert.equal(start.status, 0)

  const stateBeforeStop = readJson(stateFile)
  assert.ok(isProcessAlive(stateBeforeStop.pid))

  const stop = spawnSync(process.execPath, [reviewStopPath(), "--state-file", stateFile], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10000,
  })

  assert.equal(stop.status, 0)
  assert.match(stop.stdout, /stopped review bridge/)
  assert.equal(fs.existsSync(stateFile), false)
  assert.equal(fs.existsSync(stateBeforeStop.urlFile), false)
  assert.equal(isProcessAlive(stateBeforeStop.pid), false)
  await waitForFile(stopMarkerFile)
})

test("review start refuses to replace a live process", () => {
  const tempDir = makeTempDir("softpowers-review-launch-")
  const launcherPath = createFakeLauncherScript(tempDir)
  const stateFile = path.join(tempDir, "state.json")
  const repoDir = path.join(tempDir, "repo")
  fs.mkdirSync(repoDir)

  const start = startReviewStart(["--session", "ses_live", "--base", "main", "--repo", repoDir, "--state-file", stateFile, "--launcher-path", launcherPath])
  assert.equal(start.status, 0)

  const second = startReviewStart(["--session", "ses_other", "--base", "main", "--repo", repoDir, "--state-file", stateFile, "--launcher-path", launcherPath])
  assert.notEqual(second.status, 0)
  assert.match(second.stderr, /already running|live process/i)

  const stop = spawnSync(process.execPath, [reviewStopPath(), "--state-file", stateFile], { cwd: process.cwd(), encoding: "utf8", timeout: 10000 })
  assert.equal(stop.status, 0)
})

test("review start replaces stale state", () => {
  const tempDir = makeTempDir("softpowers-review-launch-")
  const launcherPath = createFakeLauncherScript(tempDir)
  const stateFile = path.join(tempDir, "state.json")
  const staleUrlFile = path.join(tempDir, "stale-url.txt")
  const repoDir = path.join(tempDir, "repo")
  fs.mkdirSync(repoDir)

  fs.writeFileSync(
    stateFile,
    JSON.stringify({
      pid: 999999,
      session: "ses_stale",
      base: "main",
      repo: repoDir,
      url: "http://127.0.0.1:1/",
      urlFile: staleUrlFile,
      stdoutLog: path.join(tempDir, "stale-stdout.log"),
      stderrLog: path.join(tempDir, "stale-stderr.log"),
    }),
  )
  fs.writeFileSync(staleUrlFile, "http://127.0.0.1:1/")

  const start = startReviewStart(["--session", "ses_fresh", "--base", "main", "--repo", repoDir, "--state-file", stateFile, "--launcher-path", launcherPath])
  assert.equal(start.status, 0)

  const state = readJson(stateFile)
  assert.equal(state.session, "ses_fresh")
  assert.equal(state.base, "main")
  assert.ok(isProcessAlive(state.pid))
  assert.equal(state.url, "http://127.0.0.1:4321/?session=ses_fresh&base=main")

  const stop = spawnSync(process.execPath, [reviewStopPath(), "--state-file", stateFile], { cwd: process.cwd(), encoding: "utf8", timeout: 10000 })
  assert.equal(stop.status, 0)
})

test("review start writes a session-keyed default state file", () => {
  const tempDir = makeTempDir("softpowers-review-launch-")
  const cacheHome = path.join(tempDir, "cache")
  const launcherPath = createFakeLauncherScript(tempDir)
  const repoDir = path.join(tempDir, "repo")
  fs.mkdirSync(repoDir)

  const start = startReviewStart(["--session", "ses_default", "--base", "main", "--repo", repoDir, "--launcher-path", launcherPath], {
    XDG_CACHE_HOME: cacheHome,
  })
  assert.equal(start.status, 0)

  const stateFile = sessionStateFile(cacheHome, "ses_default")
  const aliasFile = defaultAliasStateFile(cacheHome)
  const state = readJson(stateFile)
  assert.equal(state.session, "ses_default")
  assert.equal(state.repo, repoDir)
  assert.equal(typeof state.pid, "number")
  assert.ok(fs.existsSync(aliasFile))

  const stop = spawnSync(process.execPath, [reviewStopPath(), "--state-file", stateFile], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10000,
  })
  assert.equal(stop.status, 0)

  fs.rmSync(tempDir, { recursive: true, force: true })
})

test("review start replaces a live bridge for the same session", async () => {
  const tempDir = makeTempDir("softpowers-review-launch-")
  const cacheHome = path.join(tempDir, "cache")
  const launcherPath = createFakeLauncherScript(tempDir)
  const repoDir = path.join(tempDir, "repo")
  const stopMarkerFile = path.join(tempDir, "stop-marker.txt")
  fs.mkdirSync(repoDir)

  const env = {
    XDG_CACHE_HOME: cacheHome,
    FAKE_LAUNCHER_STOP_MARKER: stopMarkerFile,
  }

  const first = startReviewStart(["--session", "ses_replace", "--base", "main", "--repo", repoDir, "--launcher-path", launcherPath], env)
  assert.equal(first.status, 0)

  const stateFile = sessionStateFile(cacheHome, "ses_replace")
  const firstState = readJson(stateFile)
  assert.ok(isProcessAlive(firstState.pid))

  const second = startReviewStart(["--session", "ses_replace", "--base", "main", "--repo", repoDir, "--launcher-path", launcherPath], env)
  assert.equal(second.status, 0)

  const secondState = readJson(stateFile)
  assert.notEqual(secondState.pid, firstState.pid)
  assert.equal(isProcessAlive(firstState.pid), false)
  assert.ok(isProcessAlive(secondState.pid))
  await waitForFile(stopMarkerFile)

  const stop = spawnSync(process.execPath, [reviewStopPath(), "--state-file", stateFile], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10000,
  })
  assert.equal(stop.status, 0)

  fs.rmSync(tempDir, { recursive: true, force: true })
})

test("review start allows different sessions to keep separate state", () => {
  const tempDir = makeTempDir("softpowers-review-launch-")
  const cacheHome = path.join(tempDir, "cache")
  const launcherPath = createFakeLauncherScript(tempDir)
  const repoDir = path.join(tempDir, "repo")
  fs.mkdirSync(repoDir)

  const env = { XDG_CACHE_HOME: cacheHome }
  const first = startReviewStart(["--session", "ses_one", "--base", "main", "--repo", repoDir, "--launcher-path", launcherPath], env)
  const second = startReviewStart(["--session", "ses_two", "--base", "main", "--repo", repoDir, "--launcher-path", launcherPath], env)
  assert.equal(first.status, 0)
  assert.equal(second.status, 0)

  const firstStateFile = sessionStateFile(cacheHome, "ses_one")
  const secondStateFile = sessionStateFile(cacheHome, "ses_two")
  const firstState = readJson(firstStateFile)
  const secondState = readJson(secondStateFile)
  assert.notEqual(firstState.pid, secondState.pid)
  assert.ok(isProcessAlive(firstState.pid))
  assert.ok(isProcessAlive(secondState.pid))

  const stopFirst = spawnSync(process.execPath, [reviewStopPath(), "--state-file", firstStateFile], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10000,
  })
  const stopSecond = spawnSync(process.execPath, [reviewStopPath(), "--state-file", secondStateFile], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10000,
  })
  assert.equal(stopFirst.status, 0)
  assert.equal(stopSecond.status, 0)

  fs.rmSync(tempDir, { recursive: true, force: true })
})
