#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL="$ROOT_DIR/skills/finishing-a-development-branch/SKILL.md"

grep -q "1. Review branch locally" "$SKILL"
grep -q "2. Merge back to <base-branch> locally" "$SKILL"
grep -q "3. Push and create a Pull Request" "$SKILL"
grep -q "4. Discard this work" "$SKILL"
if grep -q "Keep the branch as-is" "$SKILL"; then
  echo "unexpected keep-as-is option still present"
  exit 1
fi
