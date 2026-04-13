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

function createHungReviewServerScript(markerPath, pidPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-manual-launch-"))
  const scriptPath = path.join(dir, "hung-review-server.cjs")
  fs.writeFileSync(
    scriptPath,
    `const fs = require("node:fs")
fs.writeFileSync(${JSON.stringify(pidPath)}, String(process.pid))
const timer = setTimeout(() => {
  process.stdout.write(JSON.stringify({ type: "review-submitted", payload: { summary: "Hung prompt" } }) + "\\n")
}, 25)

process.stdout.write(JSON.stringify({ type: "server-started", port: 4321 }) + "\\n")
process.on("SIGTERM", () => {
  clearTimeout(timer)
  fs.writeFileSync(${JSON.stringify(markerPath)}, "stopped\\n")
  process.exit(0)
})
setInterval(() => {}, 1000)
`,
  )
  return scriptPath
}

function killPidFile(pidPath) {
  if (!fs.existsSync(pidPath)) return

  try {
    const pid = Number.parseInt(fs.readFileSync(pidPath, "utf8"), 10)
    if (Number.isFinite(pid)) process.kill(pid, "SIGTERM")
  } catch {}
}

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error(`timed out waiting for ${path.basename(filePath)}`)
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

function startFakeOpencodeCli() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-opencode-cli-"))
  const argvPath = path.join(dir, "argv.json")
  const binPath = path.join(dir, "opencode")

  fs.writeFileSync(
    binPath,
    `#!/usr/bin/env node
const fs = require("node:fs")
fs.writeFileSync(${JSON.stringify(argvPath)}, JSON.stringify(process.argv.slice(2)))
process.exit(0)
`,
  )
  fs.chmodSync(binPath, 0o755)

  return {
    argvPath,
    env: {
      PATH: `${dir}${path.delimiter}${process.env.PATH || ""}`,
    },
  }
}

function startHangingOpenCodeStub() {
  let sawRequest = false

  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/session/ses_123/prompt_async") {
      res.writeHead(404, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "unexpected request" }))
      return
    }

    sawRequest = true
  })

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
        sawRequest: () => sawRequest,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      })
    })
    server.on("error", reject)
  })
}

test("manual launcher forwards the submitted review to OpenCode", { timeout: 10000 }, async (t) => {
  const reviewServerPath = createFakeReviewServerScript()
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-repo-"))
  const urlFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-manual-launch-")), "url.txt")
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
      "--url-file",
      urlFile,
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
  assert.equal(fs.readFileSync(urlFile, "utf8"), "http://127.0.0.1:4321/?session=ses_123&base=main")
  assert.equal(stderr, "")
})

test("manual launcher hands review to the opencode cli without opencode-url", { timeout: 10000 }, async (t) => {
  const reviewServerPath = createFakeReviewServerScript()
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-repo-"))
  const opencodeCli = startFakeOpencodeCli()
  const launcher = path.join(process.cwd(), ".opencode/plugins/branch-review/manual-launch.cjs")

  let stdout = ""
  let stderr = ""
  const child = spawn(
    process.execPath,
    [
      launcher,
      "--session",
      "ses_offline",
      "--review-server-path",
      reviewServerPath,
      "--repo",
      repoDir,
      "--base",
      "main",
    ],
    { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, ...opencodeCli.env } },
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

  const exit = new Promise((resolve, reject) => {
    child.on("exit", (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`launcher exited with ${code ?? signal}`))
    })
    child.on("error", reject)
  })

  await Promise.race([
    exit,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out waiting for launcher exit")), 5000)),
  ])

  assert.match(stdout, /Open http:\/\/127\.0\.0\.1:4321\/\?session=ses_offline&base=main/)
  assert.equal(stdout.includes("Local branch review"), false)
  assert.ok(fs.existsSync(opencodeCli.argvPath))
  const argv = JSON.parse(fs.readFileSync(opencodeCli.argvPath, "utf8"))
  assert.deepEqual(argv.slice(0, 5), ["run", "-s", "ses_offline", "--dir", repoDir])
  assert.match(argv[5], /Local branch review/)
  assert.match(argv[5], /Summary\nCheck the retry path/)
  assert.match(argv[5], /File: src\/app\.js/)
  assert.match(argv[5], /- new line 14: Looks good/)
  assert.match(argv[5], /Snippet: const branch = maybeBranch\(\)/)
  assert.equal(stderr, "")
})

test("manual launcher times out a hung prompt_async request", { timeout: 10000 }, async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-manual-launch-"))
  const markerPath = path.join(tempDir, "stopped.txt")
  const pidPath = path.join(tempDir, "review-server.pid")
  const reviewServerPath = createHungReviewServerScript(markerPath, pidPath)
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-repo-"))
  const opencode = await startHangingOpenCodeStub()
  const launcher = path.join(process.cwd(), ".opencode/plugins/branch-review/manual-launch.cjs")

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
      "--prompt-timeout-ms",
      "50",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  )

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString()
  })

  t.after(() => {
    child.kill()
  })
  t.after(() => {
    killPidFile(pidPath)
  })
  t.after(async () => {
    await opencode.close()
  })

  const exit = new Promise((resolve, reject) => {
    child.on("exit", (code, signal) => {
      if (code !== 0) resolve()
      else reject(new Error("launcher unexpectedly succeeded"))
    })
    child.on("error", reject)
  })

  await Promise.race([
    exit,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out waiting for launcher exit")), 5000)),
  ])

  await waitForFile(markerPath, 5000)

  assert.equal(opencode.sawRequest(), true)
  assert.match(stderr, /prompt_async timed out after 50ms/)
})
