const http = require("node:http")
const crypto = require("node:crypto")
const { execFileSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")
const https = require("node:https")

const token = crypto.randomBytes(16).toString("hex")
const submitBodyLimit = 64 * 1024

function cacheRoot() {
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "superpowers", "branch-review", "highlightjs", "11.11.1")
}

function git(args) {
  return execFileSync("git", args, { cwd: process.env.SUPERPOWERS_REVIEW_REPO, encoding: "utf8" })
}

function loadDiff() {
  const base = process.env.SUPERPOWERS_REVIEW_BASE
  const names = git(["diff", "--name-only", `${base}...HEAD`]).trim().split("\n").filter(Boolean)
  const patch = git(["diff", "--unified=3", `${base}...HEAD`])
  return { files: names, patch }
}

function loadBootstrap() {
  const head = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim()
  return {
    repo: process.env.SUPERPOWERS_REVIEW_REPO,
    base: process.env.SUPERPOWERS_REVIEW_BASE,
    head: head === "HEAD" ? git(["rev-parse", "--short", "HEAD"]).trim() : head,
  }
}

async function ensureHighlightAsset(filename, url) {
  const target = path.join(cacheRoot(), filename)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(target)) return target
  await new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`unexpected status ${res.statusCode}`))
        const out = fs.createWriteStream(target)
        res.pipe(out)
        out.on("finish", () => out.close(resolve))
        out.on("error", reject)
      })
      .on("error", reject)
  })
  return target
}

function readTemplate() {
  return fs.readFileSync(path.join(__dirname, "review-template.html"), "utf8")
}

function readClient() {
  return fs.readFileSync(path.join(__dirname, "review-client.js"), "utf8")
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let body = ""
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

      body += chunk
    })
    req.on("end", () => finish(resolve, body))
    req.on("error", (error) => finish(reject, error))
  })
}

const server = http.createServer(async (req, res) => {
  try {
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

      process.stdout.write(JSON.stringify({ type: "review-submitted", payload: body }) + "\n")

      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (req.url === "/api/diff") {
      const diff = loadDiff()
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify(diff))
      return
    }

    if (req.url === "/assets/highlight.js") {
      const asset = await ensureHighlightAsset("highlight.min.js", "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js")
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(fs.readFileSync(asset))
      return
    }

    if (req.url === "/review-client.js") {
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(readClient())
      return
    }

    if (req.url === "/") {
      const html = readTemplate().replace("{{BOOTSTRAP_JSON}}", JSON.stringify(loadBootstrap()))
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
  process.stdout.write(
    JSON.stringify({
      type: "server-started",
      port: address.port,
      url: `http://127.0.0.1:${address.port}`,
      token,
    }) + "\n",
  )
})
