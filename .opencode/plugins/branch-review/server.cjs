const http = require("node:http")
const crypto = require("node:crypto")

const token = crypto.randomBytes(16).toString("hex")

const server = http.createServer((req, res) => {
  if (req.url === "/api/submit" && req.method === "POST") {
    if (req.headers["x-review-token"] !== token) {
      res.writeHead(403, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "invalid token" }))
      return
    }
  }

  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  res.writeHead(404)
  res.end()
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
