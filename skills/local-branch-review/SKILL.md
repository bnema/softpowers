---
name: local-branch-review
description: Use when the user asks to start, stop, reopen, or control the local branch-review UI, or when an implementation workflow auto-starts the reviewer before or during execution
---

# Local Branch Review

Local branch review is the local equivalent of reviewing a GitHub pull request. The user reviews the branch diff in the browser, submits feedback, and that review is injected back into the active session so the agent can respond to it immediately.

During implementation workflows, Superpowers also auto-starts the reviewer so feedback can arrive while the work is still in progress.

## When to Use

- User asks to start, open, reopen, stop, or control the local branch-review UI
- An implementation workflow auto-starts the reviewer before or during implementation

Do not use for:

- normal finish-flow review
- generic code review requests

## Launcher Location

Use the wrapper scripts that live beside this skill file:

- `./review-start.cjs`
- `./review-stop.cjs`

Resolve those paths relative to this skill directory, not relative to the repo you are reviewing and not relative to your current working directory. In OpenCode git-plugin installs, that usually means a path inside the Superpowers package cache under `~/.cache/opencode/packages/.../skills/local-branch-review/`.

Do not assume the launcher lives at a repo-local path like `.opencode/plugins/branch-review/...`, and do not infer it from a temp attachment path.

The launcher uses the standalone `local-pr-review-server` package installed with Superpowers. Superpowers no longer ships the browser-review server runtime inside this repo.

## Commands

| Action | Command | Expected result |
|--------|---------|-----------------|
| Start | `node "./review-start.cjs" --session <session-id> --base <base-ref> --repo <repo-root>` | Prints a URL like `http://127.0.0.1:<port>/?context=<sessionID>&session=<sessionID>&base=<baseRef>` |
| Stop | `node "./review-stop.cjs" --session <session-id>` | Prints `stopped review bridge` |

## Rules

- `--session` is required. If you do not have it, ask instead of guessing.
- `--repo` should be the actual git repo root being reviewed. Do not substitute the skill cache directory, a temp file path, or some other current working directory.
- Plan-execution workflows should auto-start the reviewer immediately after workspace selection once the session ID is known. Only ask instead if the user explicitly opted out or the session ID is unavailable.
- The UI is session-bound. Return the printed URL to the user.
- To reopen, rerun the start command with the same `--session`.
- Do not pass `--state-file` for normal use.
- If stop says `review bridge state not found`, there is no tracked bridge for that session.
