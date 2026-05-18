# Softpowers for Codex

Softpowers supports Codex through native skill discovery plus a Codex plugin
manifest for local/plugin-based installs.

## Recommended Local Install

Clone this fork and symlink its skills into Codex's shared skill directory:

```bash
git clone https://github.com/bnema/softpowers.git ~/.codex/softpowers
mkdir -p ~/.agents/skills
ln -s ~/.codex/softpowers/skills ~/.agents/skills/softpowers
```

On Windows PowerShell:

```powershell
git clone https://github.com/bnema/softpowers.git "$env:USERPROFILE\.codex\softpowers"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
cmd /c mklink /J "$env:USERPROFILE\.agents\skills\softpowers" "$env:USERPROFILE\.codex\softpowers\skills"
```

Restart Codex after installing so it can discover the skills.

## Repository Instructions

Codex automatically reads `AGENTS.md` from the repository root. Keep that file
as the primary project instruction file for Codex and other agent harnesses.

If you want Codex to treat another filename as a project instruction file, add
it as a fallback filename in `~/.codex/config.toml`:

```toml
project_doc_fallback_filenames = ["TEAM_GUIDE.md"]
```

Do not rely on `CODEX.md` as a default Codex discovery file.

## Verify

```bash
codex --version
ls -la ~/.agents/skills/softpowers
```

Then open a new Codex session and ask for something skill-shaped:

```text
help me plan this feature
```

Codex should discover the Softpowers skills and use `using-softpowers` to decide
between direct execution, light guidance, and the full Softpowers workflow.

## Updating

```bash
cd ~/.codex/softpowers
git pull
```

Because the install uses a symlink, skills update as soon as the checkout is
updated. Restart Codex if skill metadata appears stale.

## Notes for Maintainers

- `.codex-plugin/plugin.json` describes the plugin shape for Codex plugin
  workflows.
- `skills/using-softpowers/references/codex-tools.md` is the compatibility map
  for translating Claude Code-oriented skill instructions into Codex tools.
- The sync workflow was adapted from upstream Superpowers and now targets the
  Softpowers plugin path by default.
