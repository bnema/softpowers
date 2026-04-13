import os from "os"
import path from "path"
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
