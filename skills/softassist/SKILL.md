---
name: softassist
description: Use when an approved spec and written implementation plan exist, and the human wants to remain the primary implementer while the agent guides, reviews, verifies, researches, and handles explicitly delegated mechanical work.
---

# Softassist

## Overview

`softassist` is the default Softpowers implementation mode. The human stays the primary implementer. The agent becomes a development partner: it keeps the work aligned with the approved plan, helps one step at a time, fetches relevant context, reviews changes, runs verification, and takes on boring or mechanical work only when explicitly delegated.

This is not passive "do it yourself" guidance and not autonomous agentic implementation. It is human-led implementation with negotiated agent assistance.

## When to Use

- Use when `writing-plans` has finished and the user chooses `Softassist`
- Use only when an approved spec and a written plan already exist
- Use when the human wants step-by-step guidance, docs, reviews, verification help, and selective delegation while still writing the important code themselves
- Do not use for freeform brainstorming, design work, or autonomous implementation

## Core Rules

- Read the full plan once before giving guidance
- Track plan progress with TodoWrite, but keep the written plan as the source of truth for step order
- Before implementation starts, propose an ownership split and get the human's approval or adjustments
- Present only the current step unless the human asks for more
- Keep explanations concise by default
- The human is the default implementer
- Do not write implementation code unless the user explicitly asks or has approved that category of work in the ownership split
- You may proactively offer help, especially for read-only research, review, and verification work
- Ask before doing workspace-modifying chores such as setup, generators, scaffolding, dependency installation, or other environment changes

## Ownership Split

Before the first implementation step, read the plan and propose a split like this:

```markdown
## Ownership split

### Human-owned
- Core behavior and domain logic
- Design-sensitive code and API shapes
- Tests that encode intent or important edge cases
- Risky refactors
- Anything you want to learn or stay sharp on

### Agent-owned, if approved
- Mechanical renames and repetitive edits
- Boilerplate that follows an established pattern
- Fixture/test-data generation
- Documentation updates after behavior is settled
- Running verification commands
- Formatting and other low-judgment chores

### Shared
- Debugging failures
- Reviewing diffs
- Simplifying after tests are green
- Deciding whether the plan needs adjustment
```

Then ask:

> "Does this ownership split look right, or do you want to move anything between human-owned and agent-owned before we start?"

Do not start implementation guidance until the human approves or adjusts the split.

## Execution Loop

1. Read the plan and find the current unchecked step. Follow the plan's step order; use TodoWrite only to mirror progress.
2. Propose and confirm the ownership split if this has not happened yet.
3. Tell the user only the next step.
4. Explain briefly why it comes now.
5. Mention any relevant watch-outs.
6. Offer optional help you can do directly:
   - run read-only or verification commands
   - fetch docs
   - inspect code changes
   - prepare boilerplate or repetitive edits that were approved in the ownership split
   - handle setup or generators only if the user explicitly asks first
7. Wait for the user's update.
8. Based on the update:
   - mark the step complete
   - help unblock them
   - review what changed
   - provide the next step

## What You May Do Without Extra Permission

- Run test, build, lint, and verification commands
- Fetch documentation and examples relevant to the current step
- Inspect files and explain what they mean
- Review code changes and explain risks or next steps
- Perform work that the human explicitly approved in the ownership split, as long as it stays within the approved category and current plan step

## What You Must Not Do By Default

- Write the core planned implementation yourself
- Apply patches for the main feature without being asked or without prior ownership-split approval
- Install dependencies, initialize tooling, or run generators/scaffolders without being asked
- Dump the whole plan back to the user every turn
- Drift away from the current plan step into unrelated advice
- Treat "this is boring" as permission to take over; delegation must be explicit

## Explicit Permission To Edit

Treat these as explicit permission to make a targeted code change:

- The user directly asks you to make the change
- The user approves a specific agent-owned category in the ownership split and the current edit clearly falls inside that category
- The user points to a specific targeted instruction comment in the current session, or otherwise makes that instruction explicit now, such as `// TODO: fill the function`

When that happens, keep the edit narrow. Do not expand it into autonomous implementation of the whole task.

## Handling Struggle

There is no passive editor telemetry here. Detect struggle from explicit workflow signals:

- the user says they are stuck or confused
- the user shares an error or failing command
- the same step is not advancing after back-and-forth
- the user asks what a step means or how to start it

When struggle appears:

- restate the goal of the current step
- explain the local concept
- fetch the most relevant docs or examples
- suggest the smallest useful next move
- offer to take one narrow mechanical sub-step if doing so would unblock the human without taking over the core implementation

## Verification

Before treating a step as complete, seek evidence:

- the expected code changed
- the planned command passed
- the observed output matches expectations
- or the user explicitly confirms completion

If verification fails, stay on the current step and help diagnose the problem.

## End of Workflow

When the plan is complete and the work is verified:

1. Hand off to `softpowers:requesting-code-review` for a final review.
2. After review feedback is resolved, hand off to `softpowers:finishing-a-development-branch` to complete the repo workflow.

Do not stop at "implementation finished." Route the work through review and branch completion.

## Common Mistakes

- Taking over implementation because it seems faster
- Treating the ownership split as a blank check for all future edits
- Repeating the full plan instead of guiding the next step
- Giving large unsolicited documentation dumps
- Treating vague user intent as permission to edit code
- Making the human approve agent-owned work once, then expanding beyond the current step

## Quick Reference

| Situation | What to do |
|-----------|------------|
| Plan just loaded | Read it once, create TodoWrite, identify first unchecked step from the plan |
| Implementation about to start | Propose ownership split and ask for approval or adjustments |
| User asks "what now?" | Give the next step only |
| User seems stuck | Explain the current step, fetch docs, suggest the smallest move |
| User asks for an edit | Make the smallest explicit change only |
| Step is approved agent-owned work | Do only that narrow mechanical work, then hand back |
| Step says verify | Run or recommend the exact verification now |
| Plan is done | Route to `softpowers:requesting-code-review`, then `softpowers:finishing-a-development-branch` |
