---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans for human-led implementation with agent assistance. Organize the work into phases, each containing bite-sized sub-tasks. Document everything the developer needs to know: which files to touch for each phase and sub-task, code shape, testing strategy, docs they might need to check, how to verify the result, and which pieces are safe to delegate. DRY. YAGNI. TDD. Frequent commits.

Assume the human is a skilled developer, but may know almost nothing about our toolset or problem domain. Assume they want to preserve their mental model of the system by staying close to the important implementation work.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in an isolated workspace. A dedicated worktree is recommended, but a fresh branch in the current directory is also supported when the human chooses that workflow.

**Save plans to:** `$PROJECTS_DOCS_PATH/{repoName}/plans/YYYY-MM-DD-<feature-name>.md` if `PROJECTS_DOCS_PATH` is set; otherwise use `docs/softpowers/plans/YYYY-MM-DD-<feature-name>.md`

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest separate plans, one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining phases and sub-tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the phase decomposition. Each phase should produce a coherent, reviewable outcome; each sub-task should be small enough to track as a concrete checklist item. Reviews are phase gates: checklist tasks are marked complete as work progresses, and external spec/code reviews happen after the whole phase is complete.

## Bite-Sized Sub-task Granularity

Each phase contains sub-tasks. Each sub-task is a self-contained implementation unit small enough for one focused human implementer, with clear notes about any low-judgment mechanical work the agent may offer to handle. Inside each sub-task, keep checkbox steps concrete and short:
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For Softpowers sessions:** Recommended implementation mode: use `softassist` so the human remains the primary implementer while the agent guides, verifies, reviews, researches, and handles explicitly delegated mechanical work. If the human explicitly chooses delegated implementation, use `subagent-driven-development` or `executing-plans` phase-by-phase. Each phase contains sub-tasks with checkbox steps (`- [ ]`) for tracking. Review gates happen at the end of each phase, not after every sub-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Phase Structure

Plans MUST be organized as 3-7 phases unless the work is tiny. Each phase should deliver a coherent, reviewable slice of the implementation. Put the two-stage review checkpoint at the end of the phase, after all sub-tasks in that phase are complete. The phase review checkpoint is not a sub-task and should not be assigned to an implementer subagent.

````markdown
### Phase N: [Reviewable Outcome]

**Goal:** [What works after this phase]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

#### Sub-task 1: [Self-contained implementation unit]

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit the sub-task work**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```

**Phase review checkpoint:**
- Spec compliance review for the full phase
- Code quality review for the full phase, only after spec compliance passes
````

## No Placeholders

Every sub-task and step must contain the actual content an engineer needs. These are **plan failures**. Never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Phase N" or "same as previous sub-task" (repeat the code because the engineer may be reading phases/sub-tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any phase or sub-task

## Remember
- Exact file paths always
- Complete code in every step that changes code
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits
- Phase boundaries should be meaningful review checkpoints, not arbitrary batches
- Review gates happen at the end of each phase, not after every task/sub-task

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself, not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a phase/sub-task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags, including any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later phases/sub-tasks match what you defined earlier? A function called `clearLayers()` in Phase 3 but `clearFullLayers()` in Phase 7 is a bug.

If you find issues, fix them inline. No need to re-review. Just fix and move on. If you find a spec requirement with no phase/sub-task, add it.

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `<resolved-plan-path>`. Choose an implementation style:**

**1. Softassist (recommended)** - You remain the primary implementer. I guide one step at a time, propose an ownership split, fetch docs, review changes, run verification, and handle explicitly delegated mechanical chores.

**2. Delegated implementation** - I implement the plan using subagents when available, or inline phase execution otherwise, with review gates at the end of each phase.

**3. Pause at planning** - Stop here; you can use the spec and plan later.

**Which approach?"**

**If Softassist chosen:**
- **REQUIRED SUB-SKILL:** Use softassist
- The human remains the primary implementer
- Propose and confirm an ownership split before implementation starts
- Guide one step at a time, not by dumping the entire plan again
- Offer to do low-value mechanical chores, verification commands, documentation lookup, and targeted edits only when explicitly delegated

**If Delegated implementation chosen:**
- Prefer `subagent-driven-development` when subagents are available
- Use `executing-plans` as the fallback when subagents are unavailable or when the human explicitly chooses inline execution
- Run phase execution with checkpoints for review

**If Delegated implementation is chosen:**
- Ask one more workspace question before implementation starts.
- First detect the repository default branch if possible. If it cannot be detected reliably, treat `main` and `master` as the default-branch candidates.
- If the current branch is the default branch, offer:
  - `New worktree` - create an isolated worktree using `softpowers:using-git-worktrees`
  - `New branch here` - create and switch to a fresh branch in the current directory
- If the current branch is any other non-default branch, offer:
  - `Continue here` - keep working on the current branch in the current directory
  - `New worktree` - create an isolated worktree using `softpowers:using-git-worktrees`
  - `New branch here` - create and switch to a fresh branch in the current directory
- For `New branch here`, ask for the new branch name before creating it.
- If the working tree is dirty and the user chooses `New branch here`, warn that uncommitted changes will remain in the current directory after the branch switch and ask whether to continue.
- Do not offer `Continue here` on the default branch.

Once workspace selection is settled and before implementation starts, start the local reviewer server automatically in that workspace so the user can review while you work. Only ask instead if the user explicitly opted out or if you do not have the required session ID.
