#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

WRITING_PLANS="$ROOT_DIR/skills/writing-plans/SKILL.md"
EXECUTING_PLANS="$ROOT_DIR/skills/executing-plans/SKILL.md"
SDD="$ROOT_DIR/skills/subagent-driven-development/SKILL.md"

echo "=== Test: plan execution workspace choice ==="

echo "Test 1: writing-plans documents workspace choices..."
if grep -q "New worktree" "$WRITING_PLANS" && \
   grep -q "New branch here" "$WRITING_PLANS" && \
   grep -q "Continue here" "$WRITING_PLANS"; then
    echo "  [PASS] writing-plans lists all workspace choices"
else
    echo "  [FAIL] writing-plans is missing one or more workspace choices"
    exit 1
fi

echo ""
echo "Test 2: writing-plans documents default vs non-default branch behavior..."
if grep -q "default branch" "$WRITING_PLANS" && \
   grep -q "non-default branch" "$WRITING_PLANS" && \
   grep -q 'Do not offer `Continue here` on the default branch' "$WRITING_PLANS"; then
    echo "  [PASS] writing-plans distinguishes default vs non-default branches"
else
    echo "  [FAIL] writing-plans does not describe branch-sensitive workspace choices"
    exit 1
fi

echo ""
echo "Test 3: execution skills no longer require worktrees only..."
if grep -q "using-git-worktrees" "$EXECUTING_PLANS" && \
   grep -Eqi "new branch here|continue here" "$EXECUTING_PLANS" && \
   grep -q "using-git-worktrees" "$SDD" && \
   grep -Eqi "new branch here|continue here" "$SDD"; then
    echo "  [PASS] execution skills describe multiple workspace modes"
else
    echo "  [FAIL] execution skills still appear to be worktree-only"
    exit 1
fi

echo ""
REMOVED_HANDOFF_PATTERN='local review(er)?[[:space:]-]+server|review[[:space:]-]+server|review[[:space:]-]+while[[:space:]-]+you[[:space:]-]+work|auto-starts?.*reviewer'

echo "Test 4: writing-plans no longer starts or mentions the removed browser handoff..."
if ! grep -Eqi "$REMOVED_HANDOFF_PATTERN" "$WRITING_PLANS"; then
    echo "  [PASS] writing-plans has no removed browser handoff startup instruction"
else
    echo "  [FAIL] writing-plans still mentions removed browser handoff startup"
    exit 1
fi

echo ""
echo "Test 5: execution skills no longer start or mention the removed browser handoff..."
if ! grep -Eqi "$REMOVED_HANDOFF_PATTERN" "$EXECUTING_PLANS" && \
   ! grep -Eqi "$REMOVED_HANDOFF_PATTERN" "$SDD"; then
    echo "  [PASS] execution skills have no removed browser handoff startup instruction"
else
    echo "  [FAIL] execution skills still mention removed browser handoff startup"
    exit 1
fi

echo ""
echo "Test 6: removed browser handoff skill has been removed..."
REMOVED_SKILL_DIR="$ROOT_DIR/skills/local-""branch""-review"
if [ ! -e "$REMOVED_SKILL_DIR/SKILL.md" ] && \
   [ ! -e "$REMOVED_SKILL_DIR/review-""start.cjs" ] && \
   [ ! -e "$REMOVED_SKILL_DIR/review-""stop.cjs" ]; then
    echo "  [PASS] removed browser handoff skill files are absent"
else
    echo "  [FAIL] removed browser handoff skill files still exist"
    exit 1
fi

echo ""
echo "Test 7: execution skills require branch naming and dirty-tree warning..."
if grep -q "Ask for the new branch name" "$EXECUTING_PLANS" && \
   grep -q "working tree is dirty" "$EXECUTING_PLANS" && \
   grep -q "Ask for the new branch name" "$SDD" && \
   grep -q "working tree is dirty" "$SDD"; then
    echo "  [PASS] execution skills define new-branch safeguards"
else
    echo "  [FAIL] execution skills are missing new-branch safeguards"
    exit 1
fi

echo ""
echo "Test 8: related skills reference the new conditional worktree usage..."
if grep -q 'REQUIRED only when the chosen workspace mode is `New worktree`' "$ROOT_DIR/skills/using-git-worktrees/SKILL.md" && \
   grep -q 'executing-plans.*Step 4' "$ROOT_DIR/skills/finishing-a-development-branch/SKILL.md"; then
    echo "  [PASS] related skill docs are aligned"
else
    echo "  [FAIL] related skill docs are still inconsistent"
    exit 1
fi

echo ""
echo "Test 9: execution docs require phase-level review gates instead of per-task review..."
if grep -q 'Review gates happen at the end of each phase, not after every task/sub-task' "$WRITING_PLANS" && \
   grep -q 'Review gates belong at the end of each phase, not after every task/sub-task' "$EXECUTING_PLANS" && \
   grep -q 'Do not dispatch reviewers after every task/sub-task' "$ROOT_DIR/skills/requesting-code-review/SKILL.md" && \
   grep -q 'dispatch external reviewers only when a reviewable slice of work is complete, not after every task/sub-task' "$SDD"; then
    echo "  [PASS] execution docs emphasize phase-level review gates"
else
    echo "  [FAIL] execution docs still allow per-task review spam"
    exit 1
fi

echo ""
echo "=== All plan workspace choice tests passed ==="
