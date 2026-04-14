---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Tell your human partner that Superpowers works much better with access to subagents. The quality of its work will be significantly higher if run on a platform with subagent support (such as Claude Code or Codex). If subagents are available, use superpowers:subagent-driven-development instead of this skill.

## The Process

### Step 1: Establish Workspace
1. Determine the repository default branch if possible. If it cannot be detected reliably, treat `main` and `master` as the default-branch candidates.
2. Determine the current branch before starting implementation
3. If already told which workspace mode to use, follow it
4. Otherwise ask:
   - On the default branch: `New worktree` or `New branch here`
   - On any other branch: `Continue here`, `New worktree`, or `New branch here`
5. For `New worktree`: use `superpowers:using-git-worktrees`
6. For `New branch here`:
    - Ask for the new branch name before creating it
    - Check whether the working tree is dirty
    - If dirty, warn that uncommitted changes will remain in the current directory after the branch switch and ask whether to continue
    - Create and switch to the fresh branch in the current directory only after confirmation
7. For `Continue here`: verify the current branch is not the default branch, then proceed in place
8. Once workspace selection is settled and before loading the plan, ask whether to start the local reviewer server in that workspace so the user can review while you work.

### Step 2: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 3: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 4: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
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
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on the default branch without explicit user consent

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - REQUIRED only when the chosen workspace mode is `New worktree`
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:finishing-a-development-branch** - Complete development after all tasks
