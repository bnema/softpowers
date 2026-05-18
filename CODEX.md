# Softpowers Codex Notes

Codex automatically reads `AGENTS.md` for repository instructions. This file is
not auto-loaded by Codex by default; it exists as a Codex-specific guide for this
fork and can be referenced manually. If you want Codex to discover it as a
project instruction file, add it to `project_doc_fallback_filenames` in
`~/.codex/config.toml`.

## What Codex Should Know

- Softpowers is a human-led fork of upstream Superpowers.
- Prefer direct execution for tiny, clearly scoped tasks.
- For larger, risky, or fuzzy work, offer the human a workflow choice before
  invoking heavy process skills: direct execution, light guidance, or full
  Softpowers flow.
- Lightweight/domain skills should still be used whenever they help.
- Do not submit upstream PRs without following the full PR rules in
  `AGENTS.md` and `.github/PULL_REQUEST_TEMPLATE.md`.
- Do not claim `CODEX.md` is a Codex auto-discovery file. `AGENTS.md` is the
  default auto-discovered project instruction file.

## Codex Skill Support

Install this fork for Codex with the local/manual path in `.codex/INSTALL.md`.
The skills live in `skills/`; Codex-specific tool mappings live in:

```text
skills/using-softpowers/references/codex-tools.md
```

Important mapping reminders:

- Claude Code `Task` maps to Codex `spawn_agent`.
- Claude Code `TodoWrite` maps to Codex `update_plan`.
- Claude Code `Bash` maps to the native shell/exec tool.
- Spawned-agent result handling is `wait_agent` in current Codex builds.

For skills that refer to named Claude agents, read the referenced prompt file and
spawn a Codex `worker` agent with that prompt content wrapped as task
instructions.

## Testing Codex Changes

At minimum, verify:

```bash
codex --version
ls -la ~/.agents/skills/softpowers
```

Then start a fresh Codex session from another repository and ask for a task that
should trigger a skill, such as:

```text
help me plan this feature
```

The expected behavior is that Codex discovers the Softpowers skills and applies
the lightweight-vs-heavy workflow selection from `using-softpowers`.
