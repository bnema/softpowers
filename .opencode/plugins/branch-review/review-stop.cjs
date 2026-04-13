const { defaultStateFile, isProcessAlive, parseArgs, readJson, removeIfExists, sleep } = require("./launch-shared.cjs")

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return
    await sleep(25)
  }

  throw new Error(`review bridge pid ${pid} did not exit after SIGTERM`)
}

async function main() {
  const args = parseArgs()
  const stateFile = args.get("state-file") || defaultStateFile()
  const state = readJson(stateFile)

  if (!state) {
    process.stderr.write("review bridge state not found\n")
    process.exit(1)
  }

  const pid = Number.parseInt(String(state.pid), 10)
  const urlFile = state.urlFile || `${stateFile}.url`

  if (isProcessAlive(pid)) {
    process.kill(pid, "SIGTERM")
    await waitForExit(pid, 5000)
  }

  removeIfExists(stateFile)
  removeIfExists(urlFile)

  process.stdout.write("stopped review bridge\n")
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
