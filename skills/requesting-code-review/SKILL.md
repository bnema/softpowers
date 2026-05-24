---
name: requesting-code-review
description: Use when completing phases, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch softpowers:code-reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation: never your session's history. This keeps the reviewer focused on the work product, not your thought process, and preserves your own context for continued work.

**Core principle:** Review at meaningful checkpoints before issues cascade. In phased plan execution, that usually means end-of-phase review gates; in delegated subagent execution it may mean reviewable slices derived from the internal dependency schedule. Do not dispatch reviewers after every task/sub-task. Run spec compliance first; only then run simplification/code-quality review.

## When to Request Review

**Mandatory:**
- At the end of each reviewable slice in subagent-driven development, and at the end of each phase in executing-plans workflows
- After completing major feature
- Before merge to main

Do not request external code review after every individual task/sub-task unless that task is explicitly the whole reviewable slice or phase.

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent:**

Use Task tool with softpowers:code-reviewer type, fill template at `code-reviewer.md`

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

`<resolved-plan-path>` means the actual plan location after resolving `$PROJECTS_DOCS_PATH`, if configured.

```
[Just completed Phase 2: Verification and repair]

You: Let me request code review before proceeding to the next phase.

BASE_SHA=$(git log --oneline | grep "Phase 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch softpowers:code-reviewer subagent]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Phase 2 from <resolved-plan-path>
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Phase 3]
```

## Simplification Review

Use this as the standard code-quality review rubric after spec compliance passes and verification is green.

**Default:** one reviewer checks all three lenses:
- **Reuse:** existing utilities/helpers/patterns that should replace new code; duplicated functionality; hand-rolled string/path/env/type-guard logic.
- **Quality:** redundant state, parameter sprawl, copy-paste variation, leaky abstractions, stringly typed code, unnecessary wrappers, comments that explain WHAT or narrate the task instead of non-obvious WHY.
- **Efficiency:** redundant work, missed safe concurrency, hot-path bloat, recurring no-op updates, TOCTOU existence checks, leaks/unbounded data, overly broad reads/loads.

**Escalate to parallel focused reviewers** for large diffs, risky refactors, performance-sensitive work, or final pre-merge review: dispatch reuse, quality, and efficiency reviewers concurrently against the same git range, then aggregate findings.

## Integration with Workflows

**Subagent-Driven Development:**
- Review after each reviewable slice, not after each task/sub-task
- A slice may be an original phase or an independent set of tasks derived from the internal dependency schedule
- First run slice spec compliance review
- Then run simplification/code-quality review only after spec compliance passes and verification is green
- Catch issues before they compound across dependent work
- Fix before unblocking dependent waves

**Executing Plans:**
- Review after each phase checkpoint, not after every task/sub-task
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: requesting-code-review/code-reviewer.md
