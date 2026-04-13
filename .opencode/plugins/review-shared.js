import os from "os"
import path from "path"
import { execFileSync } from "node:child_process"
import { spawn } from "node:child_process"
export { formatReviewPrompt } from "./branch-review/review-prompt.js"

export function xdgCacheDir() {
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "superpowers", "branch-review")
}

export function resolveBaseRef(input) {
  if (input.explicitBase) return input.explicitBase
  try {
    const originHead = execFileSync("git", ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], {
      cwd: input.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    if (originHead) return originHead
  } catch {}
  try {
    execFileSync("git", ["rev-parse", "--verify", "main"], { cwd: input.cwd, stdio: "ignore" })
    return "main"
  } catch {}
  return "master"
}

export async function waitForServerStarted(child) {
  return await new Promise((resolve, reject) => {
    let stdout = ""

    const cleanup = () => {
      child.stdout.off("data", onData)
      child.off("error", onError)
      child.off("exit", onExit)
    }

    const finish = (fn, value) => {
      cleanup()
      fn(value)
    }

    const onData = (chunk) => {
      stdout += chunk.toString()

      let newlineIndex = stdout.indexOf("\n")
      while (newlineIndex !== -1) {
        const line = stdout.slice(0, newlineIndex).trim()
        stdout = stdout.slice(newlineIndex + 1)
        if (line) {
          try {
            const message = JSON.parse(line)
            if (message?.type === "server-started") {
              finish(resolve, message)
              return
            }
          } catch {}
        }
        newlineIndex = stdout.indexOf("\n")
      }
    }

    const onError = (error) => finish(reject, error)
    const onExit = (code) => finish(reject, new Error(`review server exited early: ${code}`))

    child.stdout.on("data", onData)
    child.once("error", onError)
    child.once("exit", onExit)
  })
}

export function spawnReviewServer(args) {
  return spawn("node", [args.serverPath], {
    cwd: args.cwd,
    env: {
      ...process.env,
      SUPERPOWERS_REVIEW_REPO: args.cwd,
      SUPERPOWERS_REVIEW_BASE: args.baseRef,
      SUPERPOWERS_REVIEW_SESSION: args.sessionID,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
}
