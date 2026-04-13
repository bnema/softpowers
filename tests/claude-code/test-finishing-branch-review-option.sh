#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL="$ROOT_DIR/skills/finishing-a-development-branch/SKILL.md"

grep -q "1. Review branch locally" "$SKILL"
grep -q "2. Merge back to <base-branch> locally" "$SKILL"
grep -q "3. Push and create a Pull Request" "$SKILL"
grep -q "4. Discard this work" "$SKILL"
for stale in \
  "Keep the branch as-is" \
  "Option 1: Merge Locally" \
  "Option 2: Push and Create PR" \
  "Option 3: Keep As-Is" \
  "1. Merge locally" \
  "2. Create PR" \
  "3. Keep as-is"; do
  if grep -q "$stale" "$SKILL"; then
    echo "unexpected stale wording still present: $stale"
    exit 1
  fi
done
if grep -q "Option 1: Review branch locally" "$SKILL"; then
  :
else
  echo "missing execution guidance for review option"
  exit 1
fi
