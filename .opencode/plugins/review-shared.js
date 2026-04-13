import os from "os"
import path from "path"
import { execFileSync } from "node:child_process"
import { spawn } from "node:child_process"

export function xdgCacheDir() {
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "superpowers", "branch-review")
}

export function formatReviewPrompt(review) {
  const lines = ["Local branch review", ""]
  if (review.summary) {
    lines.push("Summary", review.summary, "")
  }
  let currentPath = null
  for (const comment of review.comments) {
    if (comment.path !== currentPath) {
      currentPath = comment.path
      lines.push(`File: ${comment.path}`)
    }
    const lineRef = comment.newLine ?? comment.oldLine ?? "unknown"
    lines.push(`- ${comment.side} line ${lineRef}: ${comment.body}`)
    lines.push(`  Snippet: ${comment.snippet}`)
  }
  return lines.join("\n")
}

export function resolveBaseRef(input) {
  if (input.explicitBase) return input.explicitBase
  if (input.upstreamBranch && input.upstreamBranch.startsWith("origin/")) return "main"
  try {
    execFileSync("git", ["merge-base", "HEAD", "main"], { cwd: input.cwd, stdio: "ignore" })
    return "main"
  } catch {}
  return "master"
}

export async function waitForServerStarted(child) {
  return await new Promise((resolve, reject) => {
    let stdout = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
      const line = stdout.trim().split("\n").at(-1)
      if (line && line.includes("server-started")) resolve(JSON.parse(line))
    })
    child.once("error", reject)
    child.once("exit", (code) => reject(new Error(`review server exited early: ${code}`)))
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
