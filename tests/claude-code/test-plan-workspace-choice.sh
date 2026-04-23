#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

WRITING_PLANS="$ROOT_DIR/skills/writing-plans/SKILL.md"
EXECUTING_PLANS="$ROOT_DIR/skills/executing-plans/SKILL.md"
SDD="$ROOT_DIR/skills/subagent-driven-development/SKILL.md"
LOCAL_BRANCH_REVIEW="$ROOT_DIR/skills/local-branch-review/SKILL.md"
OPENCODE_README="$ROOT_DIR/docs/README.opencode.md"

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
echo "Test 4: writing-plans places automatic reviewer startup after workspace selection..."
WRITING_PLANS_CONTEXT_LINE=$(grep -n 'If Subagent-Driven or Inline Execution is chosen:' "$WRITING_PLANS" | head -n1 | cut -d: -f1 || true)
WRITING_PLANS_PROMPT_LINE=$(grep -n 'review while you work' "$WRITING_PLANS" | head -n1 | cut -d: -f1 || true)
if ! grep -q 'OpenCode-only' "$WRITING_PLANS" && \
   grep -q 'start the local reviewer server automatically' "$WRITING_PLANS" && \
   [[ -n "$WRITING_PLANS_CONTEXT_LINE" && -n "$WRITING_PLANS_PROMPT_LINE" && "$WRITING_PLANS_PROMPT_LINE" -gt "$WRITING_PLANS_CONTEXT_LINE" ]]; then
    echo "  [PASS] writing-plans starts the reviewer automatically after workspace choices"
else
    echo "  [FAIL] writing-plans does not auto-start the reviewer after workspace selection"
    exit 1
fi

echo ""
echo "Test 5: execution skills place automatic reviewer startup after workspace setup..."
EXECUTING_CONTEXT_LINE=$(grep -n '### Step 1: Establish Workspace' "$EXECUTING_PLANS" | head -n1 | cut -d: -f1 || true)
EXECUTING_PROMPT_LINE=$(grep -n 'review while you work' "$EXECUTING_PLANS" | head -n1 | cut -d: -f1 || true)
SDD_CONTEXT_LINE=$(grep -n '### Workspace Setup' "$SDD" | head -n1 | cut -d: -f1 || true)
SDD_PROMPT_LINE=$(grep -n 'review while you work' "$SDD" | head -n1 | cut -d: -f1 || true)
if ! grep -q 'OpenCode-only' "$EXECUTING_PLANS" && \
   ! grep -q 'OpenCode-only' "$SDD" && \
   grep -q 'start the local reviewer server automatically' "$EXECUTING_PLANS" && \
   grep -q 'start the local reviewer server automatically' "$SDD" && \
   [[ -n "$EXECUTING_CONTEXT_LINE" && -n "$EXECUTING_PROMPT_LINE" && "$EXECUTING_PROMPT_LINE" -gt "$EXECUTING_CONTEXT_LINE" ]] && \
   [[ -n "$SDD_CONTEXT_LINE" && -n "$SDD_PROMPT_LINE" && "$SDD_PROMPT_LINE" -gt "$SDD_CONTEXT_LINE" ]]; then
    echo "  [PASS] execution skills auto-start the reviewer after workspace setup"
else
    echo "  [FAIL] execution skills do not auto-start the reviewer after workspace setup"
    exit 1
fi

echo ""
echo "Test 6: execution docs and review skill reflect automatic reviewer startup..."
if grep -q 'auto-starts the reviewer' "$LOCAL_BRANCH_REVIEW" && \
   grep -q 'before or during implementation' "$LOCAL_BRANCH_REVIEW" && \
   ! grep -q 'OpenCode-only' "$LOCAL_BRANCH_REVIEW" && \
   grep -q 'starts automatically' "$OPENCODE_README" && \
   ! grep -q 'OpenCode-only' "$OPENCODE_README" && \
   grep -q 'local reviewer server' "$OPENCODE_README"; then
    echo "  [PASS] related docs describe automatic reviewer startup"
else
    echo "  [FAIL] related docs do not describe automatic reviewer startup"
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
echo "=== All plan workspace choice tests passed ==="
