#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

USING_SUPERPOWERS="$ROOT_DIR/skills/using-superpowers/SKILL.md"
BRAINSTORMING="$ROOT_DIR/skills/brainstorming/SKILL.md"
README="$ROOT_DIR/README.md"

echo "=== Test: workflow choice guidance ==="

echo "Test 1: using-superpowers distinguishes lightweight vs heavy skills..."
if grep -q "Lightweight skills" "$USING_SUPERPOWERS" && \
   grep -q "Heavy workflow skills" "$USING_SUPERPOWERS" && \
   grep -q "do NOT need to force the full Superpowers workflow onto every task" "$USING_SUPERPOWERS"; then
    echo "  [PASS] using-superpowers defines lighter vs heavier workflow paths"
else
    echo "  [FAIL] using-superpowers still appears to force one path for every task"
    exit 1
fi

echo ""
echo "Test 2: using-superpowers documents direct, light, and full-flow modes..."
if grep -q "Direct execution" "$USING_SUPERPOWERS" && \
   grep -q "Light guidance" "$USING_SUPERPOWERS" && \
   grep -q "Full Superpowers flow" "$USING_SUPERPOWERS" && \
   grep -q "workflow-choice question" "$USING_SUPERPOWERS"; then
    echo "  [PASS] using-superpowers documents the workflow-choice gate"
else
    echo "  [FAIL] using-superpowers is missing the workflow-choice guidance"
    exit 1
fi

echo ""
echo "Test 3: brainstorming no longer claims every small task must go through formal design..."
if grep -q "Do NOT use it for tiny, targeted, or clearly-scoped requests" "$BRAINSTORMING" && \
   grep -q "offer a choice between direct execution and the full Superpowers flow first" "$BRAINSTORMING" && \
   grep -q "Once this skill is active" "$BRAINSTORMING"; then
    echo "  [PASS] brainstorming is now conditional on workflow choice"
else
    echo "  [FAIL] brainstorming still appears to be mandatory for every task"
    exit 1
fi

echo ""
echo "Test 4: README describes the lighter workflow selection behavior..."
if grep -q "workflow selection" "$README" && \
   grep -q "direct execution, light guidance, or the full Superpowers flow" "$README" && \
   grep -q "not forced onto every request" "$README"; then
    echo "  [PASS] README documents the workflow selection model"
else
    echo "  [FAIL] README does not reflect the new workflow selection model"
    exit 1
fi

echo ""
echo "=== All workflow choice tests passed ==="
