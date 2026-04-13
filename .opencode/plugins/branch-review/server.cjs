const http = require("node:http")
const crypto = require("node:crypto")
const { execFileSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const readline = require("node:readline")

const token = crypto.randomBytes(16).toString("hex")
const submitBodyLimit = 64 * 1024
const pendingSubmissions = new Map()
const allowedModuleNames = new Set([
  "review-file-tree.js",
  "review-draft-panel.js",
  "review-selection.js",
  "review-theme.js",
])

const submissionReader = readline.createInterface({ input: process.stdin })
let submissionShutdownRequested = false

function closeSubmissionServer() {
  if (submissionShutdownRequested) return
  submissionShutdownRequested = true

  try {
    submissionReader.close()
  } catch {}

  if (!server || typeof server.close !== "function") return

  try {
    server.close()
  } catch {}
}

function registerSubmissionAck(requestId) {
  return new Promise((resolve, reject) => {
    pendingSubmissions.set(requestId, { resolve, reject })
  })
}

function settleSubmissionAck(event) {
  const pending = pendingSubmissions.get(event.requestId)
  if (!pending) return false

  pendingSubmissions.delete(event.requestId)
  pending.resolve(event)
  return true
}

function rejectPendingSubmissions(message) {
  if (pendingSubmissions.size === 0) return

  const error = new Error(message)
  for (const pending of pendingSubmissions.values()) {
    pending.reject(error)
  }
  pendingSubmissions.clear()
}

submissionReader.on("line", (line) => {
  let event

  try {
    event = JSON.parse(line)
  } catch {
    return
  }

  if (event?.type !== "review-ack" || !event.requestId) return
  settleSubmissionAck(event)
})

submissionReader.on("close", () => {
  rejectPendingSubmissions("review launcher closed before acknowledging submission")
})

function requireConfiguredSession() {
  const session = process.env.SUPERPOWERS_REVIEW_SESSION
  if (session) return session

  // Hard product constraint: this review server only exists to send review
  // feedback back into a live OpenCode session. Do not relax this into a
  // standalone local diff viewer without an explicit product decision.
  process.stderr.write("SUPERPOWERS_REVIEW_SESSION is required\n")
  process.exit(1)
}

const session = requireConfiguredSession()

function git(args) {
  return execFileSync("git", args, { cwd: process.env.SUPERPOWERS_REVIEW_REPO, encoding: "utf8" })
}

function loadDiff() {
  const base = process.env.SUPERPOWERS_REVIEW_BASE
  const mergeBase = git(["merge-base", base, "HEAD"]).trim()
  const names = git(["diff", "--name-only", mergeBase]).trim().split("\n").filter(Boolean)
  const patch = git(["diff", "--unified=3", mergeBase])
  return { files: names, patch }
}

function loadBootstrap() {
  const head = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim()
  return {
    repo: process.env.SUPERPOWERS_REVIEW_REPO,
    base: process.env.SUPERPOWERS_REVIEW_BASE,
    head: head === "HEAD" ? git(["rev-parse", "--short", "HEAD"]).trim() : head,
    token,
    session,
  }
}

function readTemplate() {
  return fs.readFileSync(path.join(__dirname, "review-template.html"), "utf8")
}

function readClient() {
  return fs.readFileSync(path.join(__dirname, "review-client.js"), "utf8")
}

function readModule(name) {
  if (!allowedModuleNames.has(name)) {
    throw new Error(`unsupported module name: ${name}`)
  }

  return fs.readFileSync(path.join(__dirname, name), "utf8")
}

function readStyles() {
  return fs.readFileSync(path.join(__dirname, "review-styles.css"), "utf8")
}

function readPromptHelpers() {
  return fs.readFileSync(path.join(__dirname, "review-prompt.js"), "utf8")
}

function escapeBootstrapJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

function parseRequestUrl(req) {
  return new URL(req.url, "http://127.0.0.1")
}

function requireReviewSession(url) {
  const session = url.searchParams.get("session")
  if (session === process.env.SUPERPOWERS_REVIEW_SESSION) return null

  return { statusCode: 400, body: JSON.stringify({ error: "session is required" }) }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let settled = false
    let bytes = 0

    function finish(fn, value) {
      if (settled) return
      settled = true
      fn(value)
    }

    req.on("data", (chunk) => {
      bytes += chunk.length
      if (bytes > limit) {
        const error = new Error("request body too large")
        error.statusCode = 413
        finish(reject, error)
        req.destroy()
        return
      }

      chunks.push(chunk)
    })
    req.on("end", () => finish(resolve, Buffer.concat(chunks).toString("utf8")))
    req.on("error", (error) => finish(reject, error))
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = parseRequestUrl(req)

    function sendSubmitResponse(statusCode, payload) {
      res.once("finish", closeSubmissionServer)
      res.once("close", closeSubmissionServer)
      res.writeHead(statusCode, { "content-type": "application/json" })
      res.end(JSON.stringify(payload))
    }

    if (req.url === "/api/submit" && req.method === "POST") {
      if (req.headers["x-review-token"] !== token) {
        res.writeHead(403, { "content-type": "application/json" })
        res.end(JSON.stringify({ error: "invalid token" }))
        return
      }

      const raw = await readBody(req, submitBodyLimit)
      let body = raw
      try {
        body = JSON.parse(raw)
      } catch {}

      const requestId = crypto.randomUUID()
      const ack = registerSubmissionAck(requestId)

      process.stdout.write(JSON.stringify({ type: "review-submitted", requestId, payload: body }) + "\n")

      try {
        const result = await ack

        if (result?.ok === false) {
          sendSubmitResponse(502, { ok: false, error: result.error || result.message || "review handoff failed" })
          return
        }

        sendSubmitResponse(200, { ok: true, message: result?.message || "Review delivered to OpenCode" })
        return
      } catch (error) {
        sendSubmitResponse(502, {
          ok: false,
          error: error instanceof Error ? error.message : "review launcher closed before acknowledging submission",
        })
        return
      }
    }

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (url.pathname === "/api/diff") {
      if (req.headers["x-review-token"] !== token) {
        res.writeHead(403, { "content-type": "application/json" })
        res.end(JSON.stringify({ error: "invalid token" }))
        return
      }

      const diff = loadDiff()
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify(diff))
      return
    }

    if (url.pathname === "/review-client.js") {
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(readClient())
      return
    }

    if (url.pathname === "/review-file-tree.js") {
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(readModule("review-file-tree.js"))
      return
    }

    if (url.pathname === "/review-draft-panel.js") {
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(readModule("review-draft-panel.js"))
      return
    }

    if (url.pathname === "/review-selection.js") {
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(readModule("review-selection.js"))
      return
    }

    if (url.pathname === "/review-theme.js") {
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(readModule("review-theme.js"))
      return
    }

    if (url.pathname === "/review-styles.css") {
      res.writeHead(200, { "content-type": "text/css; charset=utf-8" })
      res.end(readStyles())
      return
    }

    if (url.pathname === "/review-prompt.js") {
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(readPromptHelpers())
      return
    }

    if (url.pathname === "/") {
      const sessionError = requireReviewSession(url)
      if (sessionError) {
        res.writeHead(sessionError.statusCode, { "content-type": "application/json" })
        res.end(sessionError.body)
        return
      }

      const html = readTemplate().replace("{{BOOTSTRAP_JSON}}", escapeBootstrapJson(loadBootstrap()))
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      res.end(html)
      return
    }

    res.writeHead(404)
    res.end()
  } catch (error) {
    if (error && error.statusCode === 413 && !res.headersSent) {
      res.writeHead(413, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "request body too large" }))
      return
    }

    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "internal server error" }))
      return
    }

    res.destroy(error)
  }
})

server.listen(0, "127.0.0.1", () => {
  const address = server.address()
  const base = process.env.SUPERPOWERS_REVIEW_BASE
  const url = new URL(`http://127.0.0.1:${address.port}/`)

  if (session) url.searchParams.set("session", session)
  if (base) url.searchParams.set("base", base)

  process.stdout.write(
    JSON.stringify({
      type: "server-started",
      port: address.port,
      url: url.toString(),
      token,
    }) + "\n",
  )
})
