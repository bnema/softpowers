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

Codex automatically reads `AGENTS.md` from the repository root. This fork also
includes `CODEX.md` as a Codex-specific human guide, but Codex does not
auto-discover that filename by default.

If you want Codex to treat `CODEX.md` as a project instruction file, add it as a
fallback filename in `~/.codex/config.toml`:

```toml
project_doc_fallback_filenames = ["CODEX.md"]
```

Keep `AGENTS.md` as the primary portable instruction file unless you have a
specific reason to customize Codex discovery locally.

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
- Upstream Superpowers has a `scripts/sync-to-codex-plugin.sh` workflow for
  mirroring into `openai-codex-plugins`. This fork should not copy that script
  verbatim unless the destination repository and branding are deliberately
  changed.
