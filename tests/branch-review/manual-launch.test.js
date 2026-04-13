import test from "node:test"
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"

test("manual launcher requires a session", () => {
  const launcher = path.join(process.cwd(), ".opencode/plugins/branch-review/manual-launch.cjs")
  const result = spawnSync(process.execPath, [launcher], { cwd: process.cwd(), encoding: "utf8" })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /session is required/)
})

function createFakeReviewServerScript() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-manual-launch-"))
  const scriptPath = path.join(dir, "fake-review-server.cjs")
  fs.writeFileSync(
    scriptPath,
    `const timer = setTimeout(() => {
  process.stdout.write(JSON.stringify({
    type: "review-submitted",
    payload: {
      summary: "Check the retry path",
      comments: [
        {
          path: "src/app.js",
          side: "new",
          newLine: 14,
          body: "Looks good",
          snippet: "const branch = maybeBranch()",
        },
        {
          path: "src/app.js",
          side: "old",
          oldLine: 7,
          body: "Needs fix",
          snippet: "const retry = false",
        },
      ],
    },
  }) + "\\n")
}, 25)

process.stdout.write(JSON.stringify({ type: "server-started", port: 4321 }) + "\\n")
process.on("SIGTERM", () => {
  clearTimeout(timer)
  process.exit(0)
})
setInterval(() => {}, 1000)
`,
  )
  return scriptPath
}

function startOpenCodeStub() {
  let resolveRequest
  let rejectRequest
  const request = new Promise((resolve, reject) => {
    resolveRequest = resolve
    rejectRequest = reject
  })

  const server = http.createServer((req, res) => {
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8")
      let parsed
      try {
        parsed = JSON.parse(body)
      } catch (error) {
        res.writeHead(400, { "content-type": "application/json" })
        res.end(JSON.stringify({ error: "invalid json" }))
        rejectRequest(error)
        return
      }

      if (req.method !== "POST" || req.url !== "/session/ses_123/prompt_async") {
        res.writeHead(404, { "content-type": "application/json" })
        res.end(JSON.stringify({ error: "unexpected request" }))
        rejectRequest(new Error(`unexpected request ${req.method} ${req.url}`))
        return
      }

      resolveRequest({ body: parsed })
      res.writeHead(204)
      res.end()
    })
  })

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
        request,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      })
    })
    server.on("error", reject)
    request.catch(reject)
  })
}

test("manual launcher forwards the submitted review to OpenCode", { timeout: 10000 }, async (t) => {
  const reviewServerPath = createFakeReviewServerScript()
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-repo-"))
  const opencode = await startOpenCodeStub()
  const launcher = path.join(process.cwd(), ".opencode/plugins/branch-review/manual-launch.cjs")

  let stdout = ""
  let stderr = ""
  const child = spawn(
    process.execPath,
    [
      launcher,
      "--session",
      "ses_123",
      "--opencode-url",
      opencode.url,
      "--review-server-path",
      reviewServerPath,
      "--repo",
      repoDir,
      "--base",
      "main",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  )

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString()
  })

  t.after(() => {
    child.kill()
  })
  t.after(async () => {
    await opencode.close()
  })

  const exit = new Promise((resolve, reject) => {
    child.on("exit", (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`launcher exited with ${code ?? signal}`))
    })
    child.on("error", reject)
  })

  const received = await Promise.race([
    opencode.request,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out waiting for prompt_async")), 5000)),
  ])

  await Promise.race([
    exit,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out waiting for launcher exit")), 5000)),
  ])

  assert.equal(received.body.directory, repoDir)
  assert.equal(received.body.noReply, false)
  assert.deepEqual(received.body.parts, [{ type: "text", text: received.body.parts[0].text }])
  assert.match(received.body.parts[0].text, /Local branch review/)
  assert.match(received.body.parts[0].text, /Summary\nCheck the retry path/)
  assert.match(received.body.parts[0].text, /File: src\/app\.js/)
  assert.match(received.body.parts[0].text, /- new line 14: Looks good/)
  assert.match(received.body.parts[0].text, /- old line 7: Needs fix/)
  assert.match(stdout, /Open http:\/\/127\.0\.0\.1:4321\/\?session=ses_123&base=main/)
  assert.equal(stderr, "")
})
