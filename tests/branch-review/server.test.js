import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import vm from "node:vm"
import path from "node:path"
import os from "node:os"
import { createRequire } from "node:module"

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

function waitForJsonEvent(child, predicate) {
  return new Promise((resolve, reject) => {
    let buffer = ""

    const cleanup = () => {
      child.stdout.off("data", onData)
      child.off("error", onError)
      child.off("exit", onExit)
    }

    const onData = (chunk) => {
      buffer += chunk.toString()

      let newlineIndex = buffer.indexOf("\n")
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf("\n")

        if (!line) continue

        let event
        try {
          event = JSON.parse(line)
        } catch {
          continue
        }

        if (predicate(event)) {
          cleanup()
          resolve(event)
          return
        }
      }
    }

    const onError = (error) => {
      cleanup()
      reject(error)
    }

    const onExit = (code, signal) => {
      cleanup()
      reject(new Error(`server exited with ${code ?? signal}`))
    }

    child.stdout.on("data", onData)
    child.once("error", onError)
    child.once("exit", onExit)
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
    stdio: ["pipe", "pipe", "pipe"],
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
    SUPERPOWERS_REVIEW_SESSION: "ses_expected",
    XDG_CACHE_HOME: cacheHome,
  }
}

function reviewEnvWithSession(session = "ses_expected") {
  return {
    ...reviewEnv(),
    SUPERPOWERS_REVIEW_SESSION: session,
  }
}

function loadReadModule(tempRoot) {
  const serverPath = path.join(process.cwd(), ".opencode/plugins/branch-review/server.cjs")
  const source = fs.readFileSync(serverPath, "utf8")
  const mockRequire = (specifier) => {
    if (specifier === "node:http") {
      return {
        createServer: () => ({
          listen(_port, _host, callback) {
            if (typeof callback === "function") callback()
          },
          address: () => ({ port: 1234 }),
        }),
      }
    }

    if (specifier === "node:child_process") {
      return { execFileSync: () => "" }
    }

    if (specifier === "node:readline") {
      return {
        createInterface: () => ({
          close() {},
          on() {},
        }),
      }
    }

    if (specifier === "node:crypto") {
      return { randomBytes: () => ({ toString: () => "token" }) }
    }

    if (specifier === "node:fs") return fs
    if (specifier === "node:path") return path

    return createRequire(import.meta.url)(specifier)
  }

  const context = {
    Buffer,
    JSON,
    URL,
    clearInterval,
    clearTimeout,
    module: { exports: {} },
    process: {
      env: {
        SUPERPOWERS_REVIEW_REPO: tempRoot,
        SUPERPOWERS_REVIEW_BASE: "main",
        SUPERPOWERS_REVIEW_SESSION: "ses_expected",
      },
      exit(code) {
        throw new Error(`unexpected exit ${code}`)
      },
      stdout: { write() {} },
      stderr: { write() {} },
    },
    require: mockRequire,
    setInterval() {
      return { unref() {} }
    },
    setTimeout,
    __dirname: path.join(tempRoot, ".opencode/plugins/branch-review"),
  }

  vm.runInNewContext(`${source}\nmodule.exports = { readModule }`, context)
  return context.module.exports.readModule
}

function loadIdleTimeoutMs(env = {}) {
  const serverPath = path.join(process.cwd(), ".opencode/plugins/branch-review/server.cjs")
  const source = fs.readFileSync(serverPath, "utf8")

  const mockRequire = (specifier) => {
    if (specifier === "node:http") {
      return {
        createServer: () => ({
          listen(_port, _host, callback) {
            if (typeof callback === "function") callback()
          },
          address: () => ({ port: 1234 }),
          close() {},
        }),
      }
    }

    if (specifier === "node:child_process") {
      return { execFileSync: () => "" }
    }

    if (specifier === "node:readline") {
      return {
        createInterface: () => ({
          close() {},
          on() {},
        }),
      }
    }

    if (specifier === "node:crypto") {
      return { randomBytes: () => ({ toString: () => "token" }) }
    }

    if (specifier === "node:fs") return fs
    if (specifier === "node:path") return path

    return createRequire(import.meta.url)(specifier)
  }

  const context = {
    Buffer,
    JSON,
    URL,
    clearInterval,
    clearTimeout,
    module: { exports: {} },
    process: {
      env: {
        SUPERPOWERS_REVIEW_REPO: process.cwd(),
        SUPERPOWERS_REVIEW_BASE: "main",
        SUPERPOWERS_REVIEW_SESSION: "ses_expected",
        ...env,
      },
      exit(code) {
        throw new Error(`unexpected exit ${code}`)
      },
      stdout: { write() {} },
      stderr: { write() {} },
    },
    require: mockRequire,
    setInterval() {
      return { unref() {} }
    },
    setTimeout,
    __dirname: path.join(process.cwd(), ".opencode/plugins/branch-review"),
  }

  vm.runInNewContext(`${source}\nmodule.exports = { idleTimeoutMs }`, context)
  return context.module.exports.idleTimeoutMs
}

test("server refuses to start without an attached session", () => {
  const serverPath = path.join(process.cwd(), ".opencode/plugins/branch-review/server.cjs")
  const result = spawn(process.execPath, [serverPath], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SUPERPOWERS_REVIEW_REPO: process.cwd(), SUPERPOWERS_REVIEW_BASE: "main" },
  })

  return new Promise((resolve, reject) => {
    let stderr = ""
    result.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    result.on("exit", (code) => {
      try {
        assert.notEqual(code, 0)
        assert.match(stderr, /SUPERPOWERS_REVIEW_SESSION is required/)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
    result.on("error", reject)
  })
})

test("server prints startup json with random port", async (t) => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started
  t.after(() => child.kill())
  assert.equal(startup.type, "server-started")
  assert.equal(typeof startup.port, "number")
  assert.match(startup.url, /^http:\/\/127\.0\.0\.1:/)
})

test("server prints a session-qualified startup url when session mode is enabled", async (t) => {
  const { child, started } = startServer(reviewEnvWithSession())
  const startup = await started
  t.after(() => child.kill())

  const startupUrl = new URL(startup.url)
  assert.equal(startup.type, "server-started")
  assert.equal(startupUrl.searchParams.get("session"), "ses_expected")
  assert.equal(startupUrl.searchParams.get("base"), "main")

  const root = await request(startup.port, `${startupUrl.pathname}${startupUrl.search}`)
  assert.equal(root.status, 200)
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

test("server rejects diff requests without a matching token", async (t) => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started
  t.after(() => child.kill())

  const diff = await request(startup.port, "/api/diff")
  assert.equal(diff.status, 403)
  assert.match(diff.body, /invalid token/)
})

test("server returns 500 when diff loading fails", async (t) => {
  const env = reviewEnv()
  env.SUPERPOWERS_REVIEW_REPO = "/definitely/missing"
  const { child, started } = startServer(env)
  const startup = await started
  t.after(() => child.kill())

  const diff = await request(startup.port, "/api/diff", {
    timeout: 2000,
    headers: { "x-review-token": startup.token },
  })
  assert.equal(diff.status, 500)

  const health = await request(startup.port, "/health")
  assert.equal(health.status, 200)
})

test("server responds to valid submit requests after the launcher acks delivery", async (t) => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started
  t.after(() => child.kill())

  const submit = request(startup.port, "/api/submit", {
    method: "POST",
    headers: { "x-review-token": startup.token },
    body: JSON.stringify({ summary: "Verify the handoff", comments: [] }),
  })
  const event = await waitForJsonEvent(child, (entry) => entry.type === "review-submitted")

  const beforeAck = await Promise.race([
    submit.then(() => "resolved"),
    new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
  ])
  assert.equal(beforeAck, "pending")

  child.stdin.write(
    JSON.stringify({
      type: "review-ack",
      requestId: event.requestId,
      ok: true,
      message: "Review delivered to OpenCode session",
    }) + "\n",
  )

  const response = await submit
  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    message: "Review delivered to OpenCode session",
  })
})

test("server returns an error when the launcher reports a failed handoff", async (t) => {
  const { child, started } = startServer(reviewEnv())
  const startup = await started
  t.after(() => child.kill())

  const submit = request(startup.port, "/api/submit", {
    method: "POST",
    headers: { "x-review-token": startup.token },
    body: JSON.stringify({ summary: "Fail the handoff", comments: [] }),
  })
  const event = await waitForJsonEvent(child, (entry) => entry.type === "review-submitted")

  child.stdin.write(
    JSON.stringify({
      type: "review-ack",
      requestId: event.requestId,
      ok: false,
      error: "prompt_async timed out after 50ms",
    }) + "\n",
  )

  const response = await submit
  assert.equal(response.status, 502)
  assert.deepEqual(JSON.parse(response.body), {
    ok: false,
    error: "prompt_async timed out after 50ms",
  })
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

  const diff = await request(startup.port, "/api/diff", { headers: { "x-review-token": startup.token } })
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

test("server defaults the idle timeout to one hour", () => {
  assert.equal(loadIdleTimeoutMs(), 3_600_000)
})

test("server exits after the idle timeout elapses", async (t) => {
  const { child, started } = startServer({
    ...reviewEnvWithSession(),
    SUPERPOWERS_REVIEW_IDLE_TIMEOUT_MS: "50",
  })

  t.after(() => child.kill())

  await started

  const exit = await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out waiting for idle shutdown")), 1000)),
  ])

  assert.equal(exit, 0)
})

test("root page includes review bootstrap state", async (t) => {
  const { child, started } = startServer(reviewEnvWithSession())
  const startup = await started
  t.after(() => child.kill())

  const root = await request(startup.port, "/?session=ses_expected")
  assert.equal(root.status, 200)
  assert.match(root.body, /<meta name="viewport" content="width=device-width, initial-scale=1">/)
  assert.match(root.body, /<script id="review-bootstrap" type="application\/json">/)
  assert.match(root.body, /@highlightjs\/cdn-assets@11\.11\.1\/styles\/github\.min\.css/)
  assert.match(root.body, /@highlightjs\/cdn-assets@11\.11\.1\/highlight\.min\.js/)
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
  assert.match(styles.body, /JetBrains Mono/)
})

test("server serves review module assets", async (t) => {
  const { child, started } = startServer(reviewEnvWithSession())
  const startup = await started
  t.after(() => child.kill())

  for (const asset of ["/review-file-tree.js", "/review-draft-panel.js", "/review-selection.js", "/review-theme.js"]) {
    const response = await request(startup.port, asset)
    assert.equal(response.status, 200)
  }
})

test("readModule rejects path-like module names", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "superpowers-branch-review-readmodule-"))
  const pluginDir = path.join(tempRoot, ".opencode/plugins/branch-review")
  fs.mkdirSync(pluginDir, { recursive: true })
  fs.writeFileSync(path.join(pluginDir, "review-file-tree.js"), "built-in asset")
  fs.writeFileSync(path.join(tempRoot, ".opencode/plugins/outside.txt"), "outside asset")

  const readModule = loadReadModule(tempRoot)

  assert.equal(readModule("review-file-tree.js"), "built-in asset")
  assert.throws(() => readModule("../outside.txt"), /invalid module name|not allowed|unsupported/i)
})

test("diff endpoint includes staged and unstaged changes from the checkout", async (t) => {
  const repo = createRepo()
  const { child, started } = startServer({ ...reviewEnv(), SUPERPOWERS_REVIEW_REPO: repo, SUPERPOWERS_REVIEW_BASE: "main" })
  const startup = await started
  t.after(() => child.kill())

  const diff = await request(startup.port, "/api/diff", { headers: { "x-review-token": startup.token } })
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

  const submit = request(startup.port, "/api/submit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-review-token": startup.token,
    },
    bodyChunks: [bytes.slice(0, split), bytes.slice(split)],
  })

  const reviewEvent = await waitForJsonEvent(child, (entry) => entry.type === "review-submitted")
  child.stdin.write(
    JSON.stringify({
      type: "review-ack",
      requestId: reviewEvent.requestId,
      ok: true,
      message: "Review delivered to OpenCode",
    }) + "\n",
  )

  const response = await submit
  assert.equal(response.status, 200)

  const line = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.includes("review-submitted"))

  assert.ok(line)
  const event = JSON.parse(line)
  assert.equal(event.payload.summary, "雪🌲")
})
