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

**Save plans to:** `$PROJECTS_DOCS_PATH/{repoName}/plans/YYYY-MM-DD-<feature-name>.html` if `PROJECTS_DOCS_PATH` is set; otherwise use `docs/softpowers/plans/YYYY-MM-DD-<feature-name>.html`

- Before resolving the save path, run `printenv PROJECTS_DOCS_PATH`.
- Resolve `{repoName}` this way:
  - git repo available: use the git top-level directory basename
  - no git repo: use the current project directory basename
  - project not on disk yet / slug still ambiguous: ask the human once and use that slug
- Author the plan in markdown first at a unique temporary path such as `PLAN_DRAFT="$(mktemp /tmp/softpowers-plan-XXXXXX.md)"`.
- Softpowers doc helpers live in the Softpowers package, not in the repo being planned. Resolve `SOFTPOWERS_ROOT` to the package root that contains this `skills/` directory, then use absolute helper paths from there for every `scripts/`, `templates/`, `examples/`, and `docs/softpowers/` reference.
- Do **not** run `node scripts/create-plan-doc.mjs` or `node scripts/validate-plan-doc.mjs` relative to the target project, and do **not** use `find` to hunt for those helpers. Resolve `SOFTPOWERS_ROOT` once from the skill/package path and reuse it.
- After the markdown draft is approved, generate the final HTML with `node "$SOFTPOWERS_ROOT/scripts/create-plan-doc.mjs" ...`.
- The helper fills `$SOFTPOWERS_ROOT/templates/plan.template.html`, builds the full TOC block, maps markdown structure into phase/task/step HTML, validates the finished document, and prints the final path clearly.
- Use small targeted snippets when they clarify a change; rely primarily on file refs, line refs, watch-outs, and verification blocks.
- Commit rule:
  - if the resolved plan path is inside the current project repo, commit it there
  - if it resolves outside the current project repo, do not also create a repo-local copy; report the external path clearly and only commit in that external docs repo when it exists and the workflow actually calls for a commit

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest separate plans, one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining phases and sub-tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the phase decomposition. Each phase should produce a coherent, reviewable outcome; each sub-task should be small enough to track as a concrete checklist item. Reviews are phase gates: checklist tasks are marked complete as work progresses, and external spec/code reviews happen after the whole phase is complete.

## Phase Structure

Plans MUST be organized as 3-7 phases unless the work is tiny. Each phase should deliver a coherent, reviewable slice of the implementation. Put the two-stage review checkpoint at the end of the phase, after all sub-tasks in that phase are complete. The phase review checkpoint is not a sub-task and should not be assigned to an implementer subagent.

Inside each sub-task, keep steps concrete and short:
- Write the failing test
- Run it to make sure it fails
- Implement the minimal code to make the test pass
- Run the tests and make sure they pass
- Commit

## Markdown-First Plan Draft

Write the plan body in markdown first. The markdown draft is the review surface for the plan reviewer subagent; the HTML file is the final canonical artifact used by `softassist` and other execution skills.

Use this structure in the temporary markdown draft (for example `$PLAN_DRAFT`):

```markdown
# Feature Name

## Phase 1: Foundation
Goal: Establish the doc tooling and tests.

Files:
- Create `scripts/plan-docs.mjs`
- Create `scripts/create-plan-doc.mjs`
- Modify `tests/html-docs/workflow-docs.test.mjs`

### Task 1: Add plan doc CLI coverage

#### Step 1: Add failing plan doc CLI tests
Kind: test
File: tests/html-docs/plan-docs-cli.test.mjs
Lines: 1-140
Command: rtk node tests/html-docs/plan-docs-cli.test.mjs
Spec section: problem-and-goals
Watchouts: Keep temp directories isolated so the assertions stay deterministic.

Write the failing coverage for the markdown-first plan workflow.

#### Step 2: Run the focused test to confirm the failure
Kind: verification
Command: rtk node tests/html-docs/plan-docs-cli.test.mjs
Watchouts: Expect the command to fail before implementation.

Capture the failure output so the next step has a clear target.
```

### Required markdown structure

- `## Phase N: Title` starts a phase.
- The next non-empty line after the phase heading must be `Goal: ...`.
- Optional `Files:` block lists the main files for that phase.
- `### Task N: Title` starts a task inside the current phase.
- `#### Step N: Title` starts a concrete step inside the current task.
- Metadata lines supported by the helper:
  - `Kind:` — one of `implementation`, `test`, `verification`, `commit`, or `review`
  - `File:` — primary file touched
  - `Lines:` — affected line range
  - `Command:` — exact verification command
  - `Spec section:` — anchor from the approved spec HTML
  - `Watchouts:` — short caution or expected result
- After the metadata lines, include the actual step body in markdown.
- For steps that change code, include the concrete code or a targeted code block that shows exactly what should be written.

## Generated HTML Shape

The final plan is still an HTML document generated from `templates/plan.template.html`. The markdown draft must contain enough detail for the helper to produce this structure:

- `{{DOC_TITLE}}` — the feature name shown in `<title>` and `<h1>`
- `{{TOC_ITEMS}}` — the full TOC block, typically `<h3>Table of contents</h3><ol><li><a href="#phase-N">Phase N: Title</a></li>...</ol>`
- Each phase renders to `<section id="phase-N" class="sp-phase" data-phase-id="phase-N">`
- Each task renders to `<article id="task-N" class="sp-task" data-task-id="task-N">`
- Each step renders to `<li id="step-N" class="sp-step" data-step-id="step-N" data-step-kind="...">`
- Use `data-file`, `data-lines`, and `data-command` metadata whenever they are available
- Include the phase review checkpoint after all tasks in the phase

**For Softpowers sessions:** Recommended implementation mode: use `softassist` so the human remains the primary implementer while the agent guides, verifies, reviews, researches, and handles explicitly delegated mechanical work. If the human explicitly chooses delegated implementation, use `subagent-driven-development` or `executing-plans` phase-by-phase.

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

After writing the complete markdown draft, look at the plan draft with fresh eyes and check the plan against the approved spec. This is a checklist you run yourself before involving the reviewer subagent.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a phase/sub-task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags, including any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later phases/sub-tasks match what you defined earlier? A function called `clearLayers()` in Phase 3 but `clearFullLayers()` in Phase 7 is a bug.

If you find issues, fix them inline. No need to re-review. Just fix and move on. If you find a spec requirement with no phase/sub-task, add it.

## Plan Review Loop

The markdown draft must be reviewed before HTML generation.

1. Save the draft to a unique temporary path such as `PLAN_DRAFT="$(mktemp /tmp/softpowers-plan-XXXXXX.md)"`.
2. Run the self-review checklist above and fix any issues in the markdown draft.
3. Dispatch a reviewer subagent using `skills/writing-plans/plan-document-reviewer-prompt.md`.
4. Give the reviewer both the markdown draft path and the approved spec HTML path.
5. If the reviewer finds issues, fix the markdown draft and re-dispatch the reviewer.
6. Only after the reviewer approves should you generate and validate the canonical HTML plan.

## HTML Generation

After the markdown review loop passes, generate the final plan HTML with:

```bash
node "$SOFTPOWERS_ROOT/scripts/create-plan-doc.mjs" \
  --title "<Plan title>" \
  --slug <feature-slug> \
  --spec <resolved-spec-path> \
  --body "$PLAN_DRAFT"
```

Then validate the output:

```bash
node "$SOFTPOWERS_ROOT/scripts/validate-plan-doc.mjs" <resolved-plan-path>
```

**This is a blocking gate:** if the validator exits non-zero or reports any errors, stop immediately, show the full validation output to the user, fix the markdown draft only, then regenerate and re-run the validator before proceeding.

If the user wants changes after reading the generated HTML, make every edit in the markdown draft, re-run the markdown review loop if the change is material, then regenerate and re-validate the HTML.

## Execution Handoff

After saving the validated HTML plan, offer execution choice:

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
