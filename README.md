# Softpowers

Softpowers is a human-led software development workflow for coding agents. It uses LLMs for exploration, specifications, planning, research, review, and verification, while keeping implementation close to the developer by default.

Softpowers is a fork of [Superpowers](https://github.com/obra/superpowers). The goal is to stay technically compatible with upstream where practical while taking a different product stance: agents should help humans think and ship better software, not silently become the default implementer.

## How it works

It starts from the moment you fire up your coding agent. When a task is tiny or clearly scoped, it can just handle it directly. When the task looks bigger, riskier, or fuzzier, it can slow down and ask whether you want direct execution, light guidance, or the full Softpowers flow.

If you choose the full flow, the agent helps tease a spec out of the conversation, then shows it to you in chunks short enough to actually read and digest.

After you've signed off on the design, your agent helps put together an implementation plan with clear phases, concrete verification steps, and enough context for a developer to execute without guessing. It emphasizes true red/green TDD, YAGNI (You Aren't Gonna Need It), DRY, and maintaining the developer's mental model of the code.

Next up, the recommended path is *Softassist*: you stay the primary implementer while the agent guides one step at a time, fetches documentation, reviews diffs, runs verification, and takes on agreed mechanical chores when useful. Fully delegated implementation is still available, but it is an explicit choice rather than the default.

There's a bunch more to it, but that's the core of the system. The heavy workflows are available when you want them, instead of being forced onto every tiny request.

## Why Softpowers?

LLMs are excellent collaborators for exploring ideas, surfacing trade-offs, drafting specifications, decomposing plans, finding documentation, reviewing changes, and running verification loops.

But implementation is not just typing. Writing, debugging, and refactoring code are how developers build and maintain their mental model of a system. If agents silently take over that work by default, the developer can lose the very cognitive skill needed to supervise those agents well.

Softpowers keeps the human in the implementation loop by default. The agent helps you think, plan, verify, and review. It can also take on boring or mechanical work when explicitly delegated. But the default workflow is human-led, not agent-led.

Use the ship's computer, not an autopilot you no longer understand.

## About this fork

This fork carries bnema-specific experiments on top of `obra/superpowers` and is being repositioned as Softpowers. Use `upstream`/`obra` for the canonical Superpowers project and `origin`/`bnema` for these custom changes.

Notable differences in this fork:

- OpenCode and Pi install/update docs point at `github.com/bnema/softpowers`.
- OpenCode has a local branch review command and browser handoff flow.
- Pi support is experimental, including `.pi/agents/` setup for subagent-based workflows.
- Heavy workflows are opt-in: small or clearly scoped tasks can stay in direct execution.
- Plan execution recommends `softassist`, where the human stays the primary implementer and the agent provides guidance, research, review, verification, and explicitly delegated mechanical help.
- Fully delegated implementation remains available for cases where the human deliberately wants the agent to implement phases or sub-tasks.
- Specs, plans, and design docs are saved as reusable HTML documents. `brainstorming` produces HTML spec documents; `writing-plans` produces HTML implementation playbooks with phase/task/step navigation; `softassist` reads HTML specs and implementation plans and guides one step at a time. When `PROJECTS_DOCS_PATH` is set, files go under `$PROJECTS_DOCS_PATH/{repoName}/plans` or `$PROJECTS_DOCS_PATH/{repoName}/specs`. When unset, Softpowers uses `docs/softpowers/` in the repo.
- The local branch review server is consumed through the `local-pr-review-server` package from `bnema/local-pr-review-server`.
- The fast Claude Code skill test runner skips `test-subagent-driven-development.sh` in this fork because it requires a working Claude Code org/session in headless mode.

These changes are fork-specific unless and until they are merged upstream.


## Installation

**Note:** Installation differs by platform. Softpowers currently prioritizes local fork compatibility rather than a separate marketplace mirror. Where a marketplace only offers upstream Superpowers, use the local/manual install path for this fork.

### Codex CLI / Codex App

For this fork, use the local/manual install path rather than the upstream Softpowers marketplace listing:

```
Fetch and follow instructions from https://raw.githubusercontent.com/bnema/softpowers/refs/heads/main/.codex/INSTALL.md
```

**Detailed docs:** [docs/README.codex.md](docs/README.codex.md)

### OpenCode

Tell OpenCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/bnema/softpowers/refs/heads/main/.opencode/INSTALL.md
```

**Detailed docs:** [docs/README.opencode.md](docs/README.opencode.md)

### Gemini CLI

```bash
gemini extensions install https://github.com/bnema/softpowers
```

To update:

```bash
gemini extensions update softpowers
```

### Pi (experimental)

```bash
pi install https://github.com/bnema/softpowers
```

Pi discovers skills from the `skills/` directory automatically. No plugins or bootstrap required for skills. For subagent-based workflows, install the bundled Pi agent profile from `.pi/agents/` (see docs).

**Detailed docs:** [docs/README.pi.md](docs/README.pi.md)

### Verify Installation

Start a new session in your chosen platform and ask for something that should trigger a skill (for example, "help me plan this feature" or "let's debug this issue"). The agent should automatically invoke the relevant Softpowers skill.

## The Basic Workflow

0. **workflow selection** - For gray-area tasks, the agent offers a choice: direct execution, light guidance, or the full Softpowers flow.

1. **brainstorming / co-design** - Activates when you choose the full design-first flow. Refines rough ideas through questions, explores alternatives, presents design in sections for validation. Saves a reusable HTML spec document.

2. **using-git-worktrees** - Activates after design approval when implementation needs an isolated workspace. Creates or verifies an isolated workspace, runs project setup, verifies clean test baseline.

3. **writing-plans / co-planning** - Activates with approved design. Produces an HTML implementation playbook with phase/task/step navigation, concrete verification steps, and enough context for human-led implementation.

4. **softassist** - Recommended after planning. The human remains the primary implementer. The agent reads the HTML plan, proposes an ownership split, guides one step at a time, fetches docs, runs verification, reviews changes, and handles agreed mechanical chores when explicitly delegated.

5. **delegated implementation** - Optional and explicit. If the human wants the agent to implement, the workflow can use `subagent-driven-development` or `executing-plans` with phase-based review gates. This is available, but not the default Softpowers path.

6. **test-driven-development** - Activates during structured implementation. Enforces RED-GREEN-REFACTOR: write failing test, watch it fail, write minimal code, watch it pass, commit. Deletes code written before tests.

7. **requesting-code-review** - Activates at phase checkpoints. Reviews against plan, reports issues by severity. Critical issues block progress.

8. **finishing-a-development-branch** - Activates when phases complete. Verifies tests, presents options (merge/PR/keep/discard), cleans up worktree.

**The agent should consider relevant skills before any task.** Lightweight skills can trigger automatically; heavyweight workflows should be offered or explicitly chosen, not forced onto every request.

## What's Inside

### Skills Library

**Testing**
- **test-driven-development** - RED-GREEN-REFACTOR cycle (includes testing anti-patterns reference)

**Debugging**
- **systematic-debugging** - 4-phase root cause process (includes root-cause-tracing, defense-in-depth, condition-based-waiting techniques)
- **verification-before-completion** - Ensure it's actually fixed

**Collaboration** 
- **brainstorming** - Socratic co-design and design refinement; saves reusable HTML spec documents
- **writing-plans** - Detailed co-planning for human-led or delegated implementation; produces HTML implementation playbooks with phase/task/step navigation
- **softassist** - Human-led implementation with agent guidance, review, verification, research, and explicitly delegated mechanical help
- **executing-plans** - Delegated inline phase execution with checkpoints
- **dispatching-parallel-agents** - Concurrent subagent workflows
- **requesting-code-review** - Pre-review checklist
- **receiving-code-review** - Responding to feedback
- **using-git-worktrees** - Parallel development branches
- **finishing-a-development-branch** - Merge/PR decision workflow
- **subagent-driven-development** - Optional delegated implementation with two-stage review at phase boundaries (spec compliance, then code quality)

**Meta**
- **writing-skills** - Create new skills following best practices (includes testing methodology)
- **using-softpowers** - Introduction to the skills system

## Philosophy

- **Human-led implementation by default** - The developer stays close to the code and keeps ownership of the system's mental model
- **LLMs as thinking tools** - Use agents for exploration, specs, plans, research, review, and verification before using them as implementers
- **Negotiated delegation** - Let agents handle boring or mechanical work when explicitly agreed, not by silent takeover
- **Test-Driven Development** - Write tests first, always
- **Systematic over ad-hoc** - Process over guessing
- **Complexity reduction** - Simplicity as primary goal
- **Evidence over claims** - Verify before declaring success

Softpowers intentionally diverges from upstream Superpowers in its default implementation stance while preserving the same discipline around tests, reviews, and verification.

## Contributing

Skills live directly in this repository. To contribute:

1. Fork the repository
2. Create a branch for your skill
3. Follow the `writing-skills` skill for creating and testing new skills
4. Submit a PR

See `skills/writing-skills/SKILL.md` for the complete guide.

## Updating

Skills update automatically when you update the plugin:

```bash
/plugin update softpowers
```

## License

MIT License - see LICENSE file for details

## Community

Softpowers is maintained as a human-led fork of upstream Superpowers.

- **Issues**: https://github.com/bnema/softpowers/issues
- **Upstream project**: https://github.com/obra/superpowers
