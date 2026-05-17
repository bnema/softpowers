---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute phases and their sub-tasks, report when complete. Review gates belong at the end of each phase, not after every task/sub-task.

This is a delegated implementation mode. Use it only when the human explicitly chooses to have the agent implement the plan rather than using `softassist`.

**Announce at start:** "I'm using the executing-plans skill as delegated implementation for this plan."

**Note:** This is the inline fallback for delegated implementation. If the human chose delegated implementation and subagents are available, prefer `softpowers:subagent-driven-development`. If the human wants to stay the primary implementer, use `softassist` instead.

## The Process

### Step 1: Establish Workspace
1. Determine the repository default branch if possible. If it cannot be detected reliably, treat `main` and `master` as the default-branch candidates.
2. Determine the current branch before starting implementation
3. If already told which workspace mode to use, follow it
4. Otherwise ask:
   - On the default branch: `New worktree` or `New branch here`
   - On any other branch: `Continue here`, `New worktree`, or `New branch here`
5. For `New worktree`: use `softpowers:using-git-worktrees`
6. For `New branch here`:
    - Ask for the new branch name before creating it
    - Check whether the working tree is dirty
    - If dirty, warn that uncommitted changes will remain in the current directory after the branch switch and ask whether to continue
    - Create and switch to the fresh branch in the current directory only after confirmation
7. For `Continue here`: verify the current branch is not the default branch, then proceed in place
8. Once workspace selection is settled and before loading the plan, start the local reviewer server automatically in that workspace so the user can review while you work. Only ask instead if the user explicitly opted out or if you do not have the required session ID.

### Step 2: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 3: Execute Phases

For each phase:
1. Mark the phase as in_progress
2. Follow each sub-task exactly (plan has bite-sized sub-tasks)
3. Run verifications as specified
4. At the phase checkpoint, run the two-stage review: spec compliance first, then simplification/code quality only after spec compliance passes and verification is green. Do not dispatch reviewers after individual sub-tasks unless the plan defines that sub-task as its own phase.
5. Fix review findings and re-review until both phase reviews pass
6. Mark the phase as completed

### Step 4: Complete Development

After all phases complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use softpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 2) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Run review gates at phase boundaries, not after every task/sub-task
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on the default branch without explicit user consent

## Integration

**Required workflow skills:**
- **softpowers:using-git-worktrees** - REQUIRED only when the chosen workspace mode is `New worktree`
- **softpowers:writing-plans** - Creates the plan this skill executes
- **softpowers:finishing-a-development-branch** - Complete development after all phases
