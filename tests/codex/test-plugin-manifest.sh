#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

python3 - "$REPO_ROOT" <<'PY'
import json
import sys
from pathlib import Path

repo_root = Path(sys.argv[1])
manifest_path = repo_root / ".codex-plugin" / "plugin.json"
hooks_path = repo_root / "hooks" / "hooks-codex.json"


def assert_equal(actual, expected, label):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


if not manifest_path.exists():
    raise AssertionError(".codex-plugin/plugin.json must exist")

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
assert_equal(manifest.get("name"), "softpowers", "plugin name")
assert_equal(manifest.get("hooks"), "./hooks/hooks-codex.json", "Codex hooks manifest")

if not hooks_path.exists():
    raise AssertionError("hooks/hooks-codex.json must exist")

hooks = json.loads(hooks_path.read_text(encoding="utf-8"))
session_start = hooks.get("hooks", {}).get("SessionStart")
if not isinstance(session_start, list) or len(session_start) != 1:
    raise AssertionError("SessionStart must contain one matcher entry")

entry = session_start[0]
assert_equal(entry.get("matcher"), "startup|resume|clear", "SessionStart matcher")
commands = entry.get("hooks")
if not isinstance(commands, list) or len(commands) != 1:
    raise AssertionError("SessionStart matcher must contain one command hook")

command = commands[0]
assert_equal(command.get("type"), "command", "hook type")
assert_equal(
    command.get("command"),
    '"${PLUGIN_ROOT}/hooks/run-hook.cmd" session-start-codex',
    "Unix Codex hook command",
)
assert_equal(
    command.get("commandWindows"),
    '& "${PLUGIN_ROOT}/hooks/run-hook.cmd" session-start-codex',
    "Windows Codex hook command",
)
assert_equal(command.get("async"), False, "hook async flag")

print("Codex plugin manifest hooks look good")
PY
