#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

USING_SOFTPOWERS="$ROOT_DIR/skills/using-softpowers/SKILL.md"
BRAINSTORMING="$ROOT_DIR/skills/brainstorming/SKILL.md"
README="$ROOT_DIR/README.md"

echo "=== Test: workflow choice guidance ==="

echo "Test 1: using-softpowers distinguishes lightweight vs heavy skills..."
if grep -q "Lightweight skills" "$USING_SOFTPOWERS" && \
   grep -q "Heavy workflow skills" "$USING_SOFTPOWERS" && \
   grep -q "do NOT need to force the full Softpowers workflow onto every task" "$USING_SOFTPOWERS"; then
    echo "  [PASS] using-softpowers defines lighter vs heavier workflow paths"
else
    echo "  [FAIL] using-softpowers still appears to force one path for every task"
    exit 1
fi

echo ""
echo "Test 2: using-softpowers documents direct, light, and full-flow modes..."
if grep -q "Direct execution" "$USING_SOFTPOWERS" && \
   grep -q "Light guidance" "$USING_SOFTPOWERS" && \
   grep -q "Full Softpowers flow" "$USING_SOFTPOWERS" && \
   grep -q "workflow-choice question" "$USING_SOFTPOWERS"; then
    echo "  [PASS] using-softpowers documents the workflow-choice gate"
else
    echo "  [FAIL] using-softpowers is missing the workflow-choice guidance"
    exit 1
fi

echo ""
echo "Test 3: brainstorming no longer claims every small task must go through formal design..."
if grep -q "Do NOT use it for tiny, targeted, or clearly-scoped requests" "$BRAINSTORMING" && \
   grep -q "offer a choice between direct execution and the full Softpowers flow first" "$BRAINSTORMING" && \
   grep -q "Once this skill is active" "$BRAINSTORMING"; then
    echo "  [PASS] brainstorming is now conditional on workflow choice"
else
    echo "  [FAIL] brainstorming still appears to be mandatory for every task"
    exit 1
fi

echo ""
echo "Test 4: README describes the lighter workflow selection behavior..."
if grep -q "workflow selection" "$README" && \
   grep -q "direct execution, light guidance, or the full Softpowers flow" "$README" && \
   grep -q "not forced onto every request" "$README"; then
    echo "  [PASS] README documents the workflow selection model"
else
    echo "  [FAIL] README does not reflect the new workflow selection model"
    exit 1
fi

echo ""
echo "=== All workflow choice tests passed ==="
