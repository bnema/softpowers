import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
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
    if (options.body) req.write(options.body)
    req.end()
  })
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

test("server prints startup json with random port", async () => {
  const { child, started } = startServer()
  const startup = await started
  assert.equal(startup.type, "server-started")
  assert.equal(typeof startup.port, "number")
  assert.match(startup.url, /^http:\/\/127\.0\.0\.1:/)
  child.kill()
})

test("server responds to health and rejects a missing token", async () => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started

  const health = await request(startup.port, "/health")
  assert.equal(health.status, 200)

  const submit = await request(startup.port, "/api/submit", { method: "POST" })
  assert.equal(submit.status, 403)
  assert.match(submit.body, /invalid token/)

  child.kill()
})

test("diff endpoint returns files and hunks", async () => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started

  const diff = await request(startup.port, "/api/diff")
  assert.equal(diff.status, 200)

  const body = JSON.parse(diff.body)
  assert.ok(Array.isArray(body.files))
  assert.ok(body.files.length > 0)
  assert.equal(typeof body.patch, "string")
  assert.match(body.patch, /diff --git/)
  assert.match(body.patch, /@@/)

  child.kill()
})

test("server exposes cached highlight assets under /assets", async () => {
  const env = reviewEnv()
  const { child, started } = startServer(env)
  const startup = await started

  const asset = await request(startup.port, "/assets/highlight.js")
  assert.equal(asset.status, 200)
  assert.match(asset.body, /highlight|hljs/)

  const cachedAsset = path.join(env.XDG_CACHE_HOME, "superpowers", "branch-review", "highlightjs", "11.11.1", "highlight.min.js")
  assert.ok(fs.existsSync(cachedAsset))

  child.kill()
})

test("root page includes review bootstrap state", async () => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started

  const root = await request(startup.port, "/")
  assert.equal(root.status, 200)
  assert.match(root.body, /window\.__REVIEW_BOOTSTRAP__/)
  assert.match(root.body, /review-client\.js/)

  const match = root.body.match(/window\.__REVIEW_BOOTSTRAP__ = (.*?)<\/script>/s)
  assert.ok(match)
  const bootstrap = JSON.parse(match[1])
  assert.equal(bootstrap.repo, process.cwd())
  assert.equal(bootstrap.base, "main")
  assert.equal(typeof bootstrap.head, "string")

  child.kill()
})
