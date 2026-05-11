import test from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { buildReviewUrl, formatReviewPrompt, resolveBaseRef, waitForServerStarted } from "../../.opencode/plugins/branch-review/review-shared.mjs"

function git(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "ignore" })
}

function createRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "softpowers-review-shared-"))
  git(dir, ["init", "-b", "main"])
  git(dir, ["config", "user.email", "test@example.com"])
  git(dir, ["config", "user.name", "Test User"])
  fs.writeFileSync(path.join(dir, "file.txt"), "base\n")
  git(dir, ["add", "file.txt"])
  git(dir, ["commit", "-m", "base"])
  return dir
}

test("formatReviewPrompt groups comments by file", () => {
  const text = formatReviewPrompt({
    summary: "Check the retry path",
    comments: [
      { path: "src/app.js", side: "new", newLine: 14, body: "This branch can be nil", snippet: "@@ -10,3 +10,4 @@" },
    ],
  })

  assert.match(text, /Local branch review/)
  assert.match(text, /src\/app.js/)
  assert.match(text, /line 14/)
  assert.match(text, /Check the retry path/)
})

test("resolveBaseRef prefers an explicit base", () => {
  const base = resolveBaseRef({ explicitBase: "main", currentBranch: "feature/x", upstreamBranch: "origin/feature/x" })

  assert.equal(base, "main")
})

test("resolveBaseRef falls back to main or master", () => {
  assert.ok(resolveBaseRef({ explicitBase: null, currentBranch: "feature/x", upstreamBranch: null }))
})

test("resolveBaseRef prefers origin HEAD when available", () => {
  const cwd = createRepo()

  git(cwd, ["update-ref", "refs/remotes/origin/develop", "HEAD"])
  git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/develop"])

  assert.equal(resolveBaseRef({ cwd, explicitBase: null, currentBranch: null, upstreamBranch: null }), "origin/develop")
})

test("waitForServerStarted resolves after split startup chunks", async () => {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()

  const started = waitForServerStarted(child)

  child.stdout.emit("data", Buffer.from('noise line\n{"type":"server-'))
  child.stdout.emit("data", Buffer.from('started","port":4321,"url":"http://127.0.0.1:4321/?context=seed"}\ntrailing line\n'))

  const result = await Promise.race([
    started,
    new Promise((resolve) => setTimeout(() => resolve("timed out"), 50)),
  ])

  assert.notEqual(result, "timed out")
  assert.deepEqual(result, { type: "server-started", port: 4321, url: "http://127.0.0.1:4321/?context=seed" })
})

test("buildReviewUrl adds the OpenCode session and base parameters", () => {
  const url = buildReviewUrl(
    { type: "server-started", port: 4321, url: "http://127.0.0.1:4321/?context=seed" },
    { sessionID: "ses_123", baseRef: "main" },
  )

  assert.equal(url, "http://127.0.0.1:4321/?context=ses_123&session=ses_123&base=main")
})
