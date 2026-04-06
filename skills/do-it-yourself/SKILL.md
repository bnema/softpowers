---
name: do-it-yourself
description: Use when an approved spec and written implementation plan exist, and the user wants to implement the plan themselves while the agent guides step by step.
---

# Do It Yourself

## Overview

`do-it-yourself` is an execution mode where the human stays the primary implementer and the agent becomes a guide. The agent should keep the user moving through the approved plan one step at a time without silently taking over implementation.

## When to Use

- Use when `writing-plans` has finished and the user chooses `Do It Yourself`
- Use only when an approved spec and a written plan already exist
- Use when the user wants step-by-step guidance, reviews, docs, and verification help while still writing the code themselves
- Do not use for freeform brainstorming, design work, or autonomous implementation

## Core Rules

- Read the full plan once before giving guidance
- Track plan progress with a todo list, but keep the written plan as the source of truth for step order
- Present only the current step unless the user asks for more
- Keep explanations concise by default
- The human is the default implementer
- Do not write implementation code unless the user explicitly asks
- You may offer to handle low-value mechanical work such as setup, generators, dependency installation, or running verification commands

## Execution Loop

1. Read the plan and find the current unchecked step. Follow the plan's step order; use the todo list only to mirror progress.
2. Tell the user only that next step.
3. Explain briefly why it comes now.
4. Mention any relevant watch-outs.
5. Offer optional help you can do directly:
   - run commands
   - fetch docs
   - inspect code changes
   - handle setup or boilerplate chores
6. Wait for the user's update.
7. Based on the update:
   - mark the step complete
   - help unblock them
   - review what changed
   - provide the next step

## What You May Do Without Extra Permission

- Run test, build, lint, and verification commands
- Install dependencies or initialize tooling
- Run code generators or scaffolders
- Fetch documentation and examples relevant to the current step
- Inspect files and explain what they mean

## What You Must Not Do By Default

- Write the planned implementation yourself
- Apply patches for the main feature without being asked
- Dump the whole plan back to the user every turn
- Drift away from the current plan step into unrelated advice

## Explicit Permission To Edit

Treat these as explicit permission to make a targeted code change:

- The user directly asks you to make the change
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

## Verification

Before treating a step as complete, seek evidence:

- the expected code changed
- the planned command passed
- the observed output matches expectations
- or the user explicitly confirms completion

If verification fails, stay on the current step and help diagnose the problem.

## Common Mistakes

- Taking over implementation because it seems faster
- Repeating the full plan instead of guiding the next step
- Giving large unsolicited documentation dumps
- Treating vague user intent as permission to edit code

## Quick Reference

| Situation | What to do |
|-----------|------------|
| Plan just loaded | Read it once, build todo list, identify first unchecked step from the plan |
| User asks "what now?" | Give the next step only |
| User seems stuck | Explain the current step, fetch docs, suggest the smallest move |
| User asks for an edit | Make the smallest explicit change only |
| Step says verify | Run or recommend the exact verification now |
