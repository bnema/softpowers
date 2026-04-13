import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import http from "node:http"
import path from "node:path"

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

function startServer() {
  const serverPath = path.join(process.cwd(), ".opencode/plugins/branch-review/server.cjs")
  const child = spawn(process.execPath, [serverPath], { stdio: ["ignore", "pipe", "pipe"] })

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

test("server prints startup json with random port", async () => {
  const { child, started } = startServer()
  const startup = await started
  assert.equal(startup.type, "server-started")
  assert.equal(typeof startup.port, "number")
  assert.match(startup.url, /^http:\/\/127\.0\.0\.1:/)
  child.kill()
})

test("server responds to health and rejects a missing token", async () => {
  const { child, started } = startServer()
  const startup = await started

  const health = await request(startup.port, "/health")
  assert.equal(health.status, 200)

  const submit = await request(startup.port, "/api/submit", { method: "POST" })
  assert.equal(submit.status, 403)
  assert.match(submit.body, /invalid token/)

  child.kill()
})
