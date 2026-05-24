#!/usr/bin/env bash
# Test: subagent-driven-development skill
# Verifies that the skill is loaded and follows correct workflow
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

echo "=== Test: subagent-driven-development skill ==="
echo ""

# Test 1: Verify skill can be loaded
echo "Test 1: Skill loading..."

output=$(run_claude "What is the subagent-driven-development skill? Describe its key steps briefly." 30)

if assert_contains "$output" "subagent-driven-development\|Subagent-Driven Development\|Subagent Driven" "Skill is recognized"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Load Plan\|read.*plan\|extract.*tasks" "Mentions loading plan"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 2: Verify skill describes correct workflow order
echo "Test 2: Workflow ordering..."

output=$(run_claude "In the subagent-driven-development skill, what comes first: spec compliance review or code quality review? Be specific about the order." 30)

if assert_order "$output" "spec.*compliance" "code.*quality" "Spec compliance before code quality"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 3: Verify self-review is mentioned
echo "Test 3: Self-review requirement..."

output=$(run_claude "Does the subagent-driven-development skill require implementers to do self-review? What should they check?" 30)

if assert_contains "$output" "self-review\|self review" "Mentions self-review"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "completeness\|Completeness" "Checks completeness"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 4: Verify plan is read once
echo "Test 4: Plan reading efficiency..."

output=$(run_claude "In subagent-driven-development, how many times should the controller read the plan file? When does this happen?" 30)

if assert_contains "$output" "once\|one time\|single" "Read plan once"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Step 1\|beginning\|start\|Load Plan" "Read at beginning"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 5: Verify spec compliance reviewer is skeptical
echo "Test 5: Spec compliance reviewer mindset..."

output=$(run_claude "What is the spec compliance reviewer's attitude toward the implementer's report in subagent-driven-development?" 30)

if assert_contains "$output" "not trust\|don't trust\|skeptical\|verify.*independently\|suspiciously" "Reviewer is skeptical"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "read.*code\|inspect.*code\|verify.*code" "Reviewer reads code"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 6: Verify review loops
echo "Test 6: Review loop requirements..."

output=$(run_claude "In subagent-driven-development, what happens if a reviewer finds issues? Is it a one-time review or a loop?" 30)

if assert_contains "$output" "loop\|again\|repeat\|until.*approved\|until.*compliant" "Review loops mentioned"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "implementer.*fix\|fix.*issues" "Implementer fixes issues"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 7: Verify full task text is provided
echo "Test 7: Task context provision..."

output=$(run_claude "In subagent-driven-development, how does the controller provide task information to the implementer subagent? Does it make them read a file or provide it directly?" 30)

if assert_contains "$output" "provide.*directly\|full.*text\|paste\|include.*prompt" "Provides text directly"; then
    : # pass
else
    exit 1
fi

if assert_not_contains "$output" "read.*file\|open.*file" "Doesn't make subagent read file"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 8: Verify workspace setup requirement
echo "Test 8: Workspace setup requirement..."

output=$(run_claude "What workflow skills are required before using subagent-driven-development? List any prerequisites or required skills." 30)

if assert_contains "$output" "using-git-worktrees\|worktree\|new branch here\|continue here\|workspace" "Mentions workspace setup requirement"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 9: Verify main branch warning
echo "Test 9: Main branch red flag..."

output=$(run_claude "In subagent-driven-development, is it okay to start implementation directly on the main branch?" 30)

if assert_contains "$output" "worktree\|feature.*branch\|not.*main\|never.*main\|avoid.*main\|don't.*main\|consent\|permission" "Warns against main branch"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 10: Verify delegated implementation parallelization pass
echo "Test 10: Parallel execution organization..."

output=$(run_claude "When a user chooses delegated implementation with subagent-driven-development, should the controller rewrite the plan, or internally rethink phases/tasks for parallel execution? Mention session tool discovery." 30)

if assert_contains "$output" "session.*tool\|tool.*discover\|subagent.*capabilit\|capabilit.*subagent" "Discovers session tools/subagent capabilities"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "parallel\|dependency\|wave\|DAG\|independent" "Builds a parallel execution organization"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "do not rewrite\|without rewriting\|canonical plan unchanged\|not rewrite" "Does not rewrite the plan"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 11: Verify prompt templates support slices and parallel boundaries
echo "Test 11: Prompt template consistency..."

SDD_DIR="$SCRIPT_DIR/../../skills/subagent-driven-development"

if grep -q "reviewable slice" "$SDD_DIR/spec-reviewer-prompt.md" && grep -q "Slice Requirements" "$SDD_DIR/phase-fix-prompt.md" && grep -q "reviewable slice" "$SDD_DIR/code-quality-reviewer-prompt.md"; then
    echo "  [PASS] Reviewer/fix templates support reviewable slices"
else
    echo "  [FAIL] Reviewer/fix templates must support reviewable slices"
    exit 1
fi

if grep -q "parallel session" "$SDD_DIR/SKILL.md"; then
    echo "  [FAIL] subagent-driven-development should not describe executing-plans as a parallel-session fallback"
    exit 1
else
    echo "  [PASS] Fallback wording avoids stale parallel-session language"
fi

if grep -q "Parallel Execution Boundaries" "$SDD_DIR/implementer-prompt.md" && grep -q "Do not edit outside your claimed scope" "$SDD_DIR/implementer-prompt.md"; then
    echo "  [PASS] Implementer template includes parallel safety boundaries"
else
    echo "  [FAIL] Implementer template must include parallel safety boundaries"
    exit 1
fi

echo ""

echo "=== All subagent-driven-development skill tests passed ==="
