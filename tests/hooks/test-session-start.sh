#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CODEX_HOOK_UNDER_TEST="$REPO_ROOT/hooks/session-start-codex"
WRAPPER_UNDER_TEST="$REPO_ROOT/hooks/run-hook.cmd"

FAILURES=0
TEST_ROOT="$(mktemp -d)"

cleanup() {
    rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

pass() {
    echo "  [PASS] $1"
}

fail() {
    echo "  [FAIL] $1"
    FAILURES=$((FAILURES + 1))
}

make_home() {
    local name="$1"
    local home="$TEST_ROOT/$name/home"
    mkdir -p "$home"
    printf '%s\n' "$home"
}

assert_codex_session_context() {
    local description="$1"
    local home="$2"
    shift 2

    local output
    if ! output="$(env -i PATH="${PATH:-}" HOME="$home" "$@" 2>&1)"; then
        fail "$description"
        echo "    hook exited non-zero"
        echo "$output" | sed 's/^/      /'
        return
    fi

    if printf '%s' "$output" | node -e '
const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
let payload;
try {
  payload = JSON.parse(input);
} catch (error) {
  console.error(`invalid JSON: ${error.message}`);
  process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const hookOutput = payload.hookSpecificOutput;
if (!hookOutput || typeof hookOutput !== "object" || Array.isArray(hookOutput)) {
  fail("missing nested hookSpecificOutput object");
}
if (hookOutput.hookEventName !== "SessionStart") {
  fail(`unexpected hookEventName: ${hookOutput.hookEventName}`);
}
if (Object.prototype.hasOwnProperty.call(payload, "additionalContext") ||
    Object.prototype.hasOwnProperty.call(payload, "additional_context")) {
  fail("Codex hook emitted duplicate top-level context fields");
}

const context = hookOutput.additionalContext;
if (typeof context !== "string" || context.trim() === "") {
  fail("additionalContext was empty");
}
for (const expected of [
  "You have softpowers.",
  "softpowers:using-softpowers",
  "For all other skills, follow the Codex skill-loading instructions in that skill"
]) {
  if (!context.includes(expected)) {
    fail(`context did not include expected text: ${expected}`);
  }
}
for (const forbidden of ["superpowers:using-superpowers", "You have superpowers."]) {
  if (context.includes(forbidden)) {
    fail(`context included forbidden upstream branding: ${forbidden}`);
  }
}
'; then
        pass "$description"
    else
        fail "$description"
        echo "    output:"
        echo "$output" | sed 's/^/      /'
    fi
}

echo "Codex SessionStart hook output tests"

codex_home="$(make_home codex-plugin-hooks)"
codex_data="$TEST_ROOT/codex-plugin-hooks/data"
mkdir -p "$codex_data"
assert_codex_session_context \
    "Codex plugin hooks emit nested SessionStart additionalContext" \
    "$codex_home" \
    PLUGIN_DATA="$codex_data" \
    CLAUDE_PLUGIN_DATA="$codex_data" \
    PLUGIN_ROOT="$REPO_ROOT" \
    CLAUDE_PLUGIN_ROOT="$REPO_ROOT" \
    bash "$CODEX_HOOK_UNDER_TEST"

wrapper_home="$(make_home codex-wrapper)"
wrapper_data="$TEST_ROOT/codex-wrapper/data"
mkdir -p "$wrapper_data"
assert_codex_session_context \
    "Codex wrapper dispatches to dedicated SessionStart script" \
    "$wrapper_home" \
    PLUGIN_DATA="$wrapper_data" \
    CLAUDE_PLUGIN_DATA="$wrapper_data" \
    PLUGIN_ROOT="$REPO_ROOT" \
    CLAUDE_PLUGIN_ROOT="$REPO_ROOT" \
    bash "$WRAPPER_UNDER_TEST" session-start-codex

if [[ "$FAILURES" -gt 0 ]]; then
    echo "STATUS: FAILED ($FAILURES failure(s))"
    exit 1
fi

echo "STATUS: PASSED"
