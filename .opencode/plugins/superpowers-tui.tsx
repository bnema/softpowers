type TuiPlugin = (api: any) => void
type TuiPluginModule = { id: string; tui: TuiPlugin }

import { formatReviewPrompt, resolveBaseRef, spawnReviewServer, waitForServerStarted } from "./review-shared.js"

// @ts-expect-error OpenCode loads this plugin as an ES module.
const bundledServerPath = decodeURIComponent(new URL("./branch-review/server.cjs", import.meta.url).pathname)

const tui: TuiPlugin = (api) => {
  let child: ReturnType<typeof spawnReviewServer> | null = null

  api.lifecycle.onDispose(() => {
    if (child && !child.killed) child.kill()
  })

  api.command.register(() => [
    {
      title: "Review branch locally",
      value: "superpowers.review-branch-locally",
      category: "Superpowers",
      slash: { name: "review-branch-locally", aliases: ["review-branch"] },
      onSelect: () => {
        if (api.route.current.name !== "session") {
          api.ui.toast({ variant: "error", message: "Open a session before starting branch review" })
          return
        }

        if (child && !child.killed) {
          api.ui.toast({ variant: "error", message: "A review server is already running" })
          return
        }

        const sessionID = api.route.current.params.sessionID as string
        const baseRef = resolveBaseRef({ cwd: api.state.path.directory, explicitBase: null, currentBranch: api.state.vcs?.branch || null, upstreamBranch: null })
        child = spawnReviewServer({
          serverPath: bundledServerPath,
          cwd: api.state.path.directory,
          sessionID,
          baseRef,
        })

        const spawnedChild = child
        const stdout = child.stdout
        if (!stdout) throw new Error("review server missing stdout")
        const stderr = child.stderr
        let stderrBuffer = ""

        if (stderr) {
          stderr.on("data", (chunk) => {
            stderrBuffer += chunk.toString()
            if (stderrBuffer.length > 2048) stderrBuffer = stderrBuffer.slice(-2048)
          })
        }

        spawnedChild.once("exit", (code, signal) => {
          const wasCurrentChild = child === spawnedChild
          if (wasCurrentChild) child = null
          if (!wasCurrentChild || code === 0) return
          const lastLine = stderrBuffer.trim().split("\n")
          const details = stderrBuffer ? `: ${lastLine[lastLine.length - 1]}` : signal ? ` (${signal})` : ""
          api.ui.toast({ variant: "error", message: `Review server exited unexpectedly${details}` })
        })

        let buffer = ""
        const handleSubmitted = (line: string) => {
          const event = JSON.parse(line)
          const text = formatReviewPrompt(event.payload)
          return api.client.session.promptAsync({
            sessionID,
            directory: api.state.path.directory,
            parts: [{ type: "text", text }],
          }).then(() => {
            if (child === spawnedChild && !spawnedChild.killed) spawnedChild.kill()
            child = null
            api.route.navigate("session", { sessionID })
            api.ui.toast({ variant: "success", message: "Review sent to the active session" })
          })
        }

        stdout.on("data", (chunk) => {
          buffer += chunk.toString()
          let newlineIndex = buffer.indexOf("\n")
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).trim()
            buffer = buffer.slice(newlineIndex + 1)
            if (line.indexOf("review-submitted") !== -1) {
              void handleSubmitted(line).catch((error) => {
                api.ui.toast({ variant: "error", message: error instanceof Error ? error.message : "Failed to submit review" })
              })
            }
            newlineIndex = buffer.indexOf("\n")
          }
        })

        waitForServerStarted(child).then((started) => {
          api.ui.toast({ variant: "info", message: `Open ${started.url} in your browser` })
        }).catch((error) => {
          api.ui.toast({ variant: "error", message: error instanceof Error ? error.message : "Review server failed to start" })
          child = null
        })
      },
    },
  ])
}

const plugin: TuiPluginModule & { id: string } = {
  id: "superpowers.review",
  tui,
}

export default plugin
