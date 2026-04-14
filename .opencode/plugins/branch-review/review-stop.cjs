const {
  defaultStateFile,
  isProcessAlive,
  killProcessTree,
  parseArgs,
  readJson,
  removeStateArtifacts,
  sessionStateFile,
  waitForExit,
} = require("./launch-shared.cjs")

function resolveStateFile(args) {
  const explicitStateFile = args.get("state-file")
  if (explicitStateFile) return explicitStateFile

  const session = args.get("session")
  if (session) return sessionStateFile(session)

  return defaultStateFile()
}

function removeAliasIfMatches(state) {
  const aliasStateFile = defaultStateFile()
  const aliasState = readJson(aliasStateFile)
  if (!aliasState) {
    removeStateArtifacts(aliasStateFile)
    return
  }

  if (aliasState.pid === state.pid && aliasState.session === state.session) {
    removeStateArtifacts(aliasStateFile, aliasState)
  }
}

async function main() {
  const args = parseArgs()
  const stateFile = resolveStateFile(args)
  const state = readJson(stateFile)

  if (!state) {
    process.stderr.write("review bridge state not found\n")
    process.exit(1)
  }

  const pid = Number.parseInt(String(state.pid), 10)

  if (isProcessAlive(pid)) {
    killProcessTree(pid, "SIGTERM")
    await waitForExit(pid, 5000)
  }

  removeStateArtifacts(stateFile, state)
  removeAliasIfMatches(state)

  process.stdout.write("stopped review bridge\n")
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
