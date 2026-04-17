#!/usr/bin/env node

const path = require("node:path")
const { spawnSync } = require("node:child_process")

const launcherPath = path.resolve(__dirname, "../../.opencode/plugins/branch-review/review-stop.cjs")
const result = spawnSync(process.execPath, [launcherPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
})

if (result.error) {
  process.stderr.write(`${result.error.message}\n`)
  process.exit(1)
}

if (typeof result.status === "number") {
  process.exit(result.status)
}

process.exit(1)
