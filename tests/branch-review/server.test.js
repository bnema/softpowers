import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import os from "node:os"

async function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: pathname, method: options.method || "GET", headers: options.headers || {} },
      (res) => {
        let body = ""
        res.on("data", (chunk) => (body += chunk))
        res.on("end", () => resolve({ status: res.statusCode, body }))
      },
    )
    req.on("error", reject)
    if (options.timeout) req.setTimeout(options.timeout, () => req.destroy(new Error(`request timed out after ${options.timeout}ms`)))
    if (Array.isArray(options.bodyChunks)) {
      for (const chunk of options.bodyChunks) req.write(chunk)
    } else if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

function git(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "ignore" })
}

function createRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-branch-review-"))
  git(repo, ["init", "-b", "main"])
  git(repo, ["config", "user.email", "test@example.com"])
  git(repo, ["config", "user.name", "Test User"])
  fs.writeFileSync(path.join(repo, "tracked.txt"), "base\n")
  git(repo, ["add", "tracked.txt"])
  git(repo, ["commit", "-m", "base"])
  git(repo, ["checkout", "-b", "feature"])
  fs.writeFileSync(path.join(repo, "tracked.txt"), "base\nfeature commit\n")
  git(repo, ["add", "tracked.txt"])
  git(repo, ["commit", "-m", "feature commit"])
  fs.writeFileSync(path.join(repo, "staged.txt"), "staged change\n")
  git(repo, ["add", "staged.txt"])
  fs.writeFileSync(path.join(repo, "tracked.txt"), "base\nfeature commit\nunstaged change\n")
  return repo
}

function startServer(env = {}) {
  const serverPath = path.join(process.cwd(), ".opencode/plugins/branch-review/server.cjs")
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  })

  const started = new Promise((resolve, reject) => {
    let buffer = ""
    child.stdout.on("data", (chunk) => {
      buffer += chunk
      const line = buffer.split("\n").find(Boolean)
      if (line) {
        try {
          resolve(JSON.parse(line))
        } catch (error) {
          reject(error)
        }
      }
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code !== 0) reject(new Error(`server exited with ${code}`))
    })
  })

  return { child, started }
}

function reviewEnv() {
  const cacheHome = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-branch-review-"))
  return {
    SUPERPOWERS_REVIEW_REPO: process.cwd(),
    SUPERPOWERS_REVIEW_BASE: "main",
    XDG_CACHE_HOME: cacheHome,
  }
}

function reviewEnvWithSession(session = "ses_expected") {
  return {
    ...reviewEnv(),
    SUPERPOWERS_REVIEW_SESSION: session,
  }
}

test("server prints startup json with random port", async (t) => {
  const { child, started } = startServer()
  const startup = await started
  t.after(() => child.kill())
  assert.equal(startup.type, "server-started")
  assert.equal(typeof startup.port, "number")
  assert.match(startup.url, /^http:\/\/127\.0\.0\.1:/)
})

test("server responds to health and rejects a missing token", async (t) => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started
  t.after(() => child.kill())

  const health = await request(startup.port, "/health")
  assert.equal(health.status, 200)

  const submit = await request(startup.port, "/api/submit", { method: "POST" })
  assert.equal(submit.status, 403)
  assert.match(submit.body, /invalid token/)
})

test("server returns 500 when diff loading fails", async (t) => {
  const env = reviewEnv()
  env.SUPERPOWERS_REVIEW_REPO = "/definitely/missing"
  const { child, started } = startServer(env)
  const startup = await started
  t.after(() => child.kill())

  const diff = await request(startup.port, "/api/diff", { timeout: 2000 })
  assert.equal(diff.status, 500)

  const health = await request(startup.port, "/health")
  assert.equal(health.status, 200)
})

test("server responds to valid submit requests with ok response", async (t) => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started
  t.after(() => child.kill())

  const submit = await request(startup.port, "/api/submit", { method: "POST", headers: { "x-review-token": startup.token } })
  assert.equal(submit.status, 200)
  assert.deepEqual(JSON.parse(submit.body), { ok: true })
})

test("server rejects root requests without a matching session", async (t) => {
  const { child, started } = startServer(reviewEnvWithSession())
  const startup = await started
  t.after(() => child.kill())

  const root = await request(startup.port, "/")
  assert.equal(root.status, 400)
  assert.match(root.body, /session is required/)
})

test("diff endpoint returns files and hunks", async (t) => {
  const repo = createRepo()
  const { child, started } = startServer({ ...reviewEnv(), SUPERPOWERS_REVIEW_REPO: repo, SUPERPOWERS_REVIEW_BASE: "main" })
  const startup = await started
  t.after(() => child.kill())

  const diff = await request(startup.port, "/api/diff")
  assert.equal(diff.status, 200)

  const body = JSON.parse(diff.body)
  assert.ok(Array.isArray(body.files))
  assert.ok(body.files.length > 0)
  assert.equal(typeof body.patch, "string")
  assert.match(body.patch, /diff --git/)
  assert.match(body.patch, /@@/)
})

test("server no longer serves a remote highlight asset", async (t) => {
  const env = reviewEnv()
  const { child, started } = startServer(env)
  const startup = await started
  t.after(() => child.kill())

  const asset = await request(startup.port, "/assets/highlight.js")
  assert.equal(asset.status, 404)
})

test("root page includes review bootstrap state", async (t) => {
  const { child, started } = startServer(reviewEnvWithSession())
  const startup = await started
  t.after(() => child.kill())

  const root = await request(startup.port, "/?session=ses_expected")
  assert.equal(root.status, 200)
  assert.match(root.body, /<script id="review-bootstrap" type="application\/json">/)
  assert.match(root.body, /review-client\.js/)
  assert.doesNotMatch(root.body, /assets\/highlight\.js/)

  const match = root.body.match(/<script id="review-bootstrap" type="application\/json">(.*?)<\/script>/s)
  assert.ok(match)
  const bootstrap = JSON.parse(match[1])
  assert.equal(bootstrap.repo, process.cwd())
  assert.equal(bootstrap.base, "main")
  assert.equal(typeof bootstrap.head, "string")
  assert.equal(typeof bootstrap.token, "string")
  assert.equal(bootstrap.session, "ses_expected")
})

test("root page loads review styles", async (t) => {
  const { child, started } = startServer(reviewEnvWithSession())
  const startup = await started
  t.after(() => child.kill())

  const root = await request(startup.port, "/?session=ses_expected")
  assert.equal(root.status, 200)
  assert.match(root.body, /href="\/review-styles\.css"/)

  const styles = await request(startup.port, "/review-styles.css")
  assert.equal(styles.status, 200)
  assert.match(styles.body, /--surface-primary/)
})

test("diff endpoint includes staged and unstaged changes from the checkout", async (t) => {
  const repo = createRepo()
  const { child, started } = startServer({ ...reviewEnv(), SUPERPOWERS_REVIEW_REPO: repo, SUPERPOWERS_REVIEW_BASE: "main" })
  const startup = await started
  t.after(() => child.kill())

  const diff = await request(startup.port, "/api/diff")
  assert.equal(diff.status, 200)

  const body = JSON.parse(diff.body)
  assert.ok(body.files.includes("tracked.txt"))
  assert.ok(body.files.includes("staged.txt"))
  assert.match(body.patch, /feature commit/)
  assert.match(body.patch, /staged change/)
  assert.match(body.patch, /unstaged change/)
})

test("submit preserves multibyte request bodies across split chunks", async (t) => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started
  t.after(() => child.kill())

  let stdout = ""
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString()
  })

  const payload = JSON.stringify({ summary: "雪🌲", comments: [] })
  const bytes = Buffer.from(payload)
  const split = Buffer.from('{"summary":"').length + 1

  const submit = await request(startup.port, "/api/submit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-review-token": startup.token,
    },
    bodyChunks: [bytes.slice(0, split), bytes.slice(split)],
  })

  assert.equal(submit.status, 200)

  const line = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.includes("review-submitted"))

  assert.ok(line)
  const event = JSON.parse(line)
  assert.equal(event.payload.summary, "雪🌲")
})
