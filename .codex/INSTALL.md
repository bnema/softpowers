# Installing Softpowers for Codex

Enable softpowers skills in Codex via native skill discovery. Clone the repo and
symlink each skill directory into Codex's shared skill directory.

## Prerequisites

- Git

## Installation

1. **Clone the softpowers repository:**
   ```bash
   git clone https://github.com/bnema/softpowers.git ~/.codex/softpowers
   ```

2. **Create the skill symlinks:**
   ```bash
   mkdir -p ~/.agents/skills
   for skill in ~/.codex/softpowers/skills/*; do
     ln -sfn "$skill" ~/.agents/skills/"$(basename "$skill")"
   done
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   Get-ChildItem "$env:USERPROFILE\.codex\softpowers\skills" -Directory | ForEach-Object {
       $target = Join-Path "$env:USERPROFILE\.agents\skills" $_.Name
       if (Test-Path $target) { Remove-Item $target -Force -Recurse }
       cmd /c mklink /J "$target" $_.FullName
   }
   ```

3. **Restart Codex** (quit and relaunch the CLI) to discover the skills.

## Migrating from old bootstrap

If you installed softpowers before native skill discovery, you need to:

1. **Update the repo:**
   ```bash
   cd ~/.codex/softpowers && git pull
   ```

2. **Create the skill symlinks** (step 2 above). This is the new discovery mechanism.

3. **Remove the old bootstrap block** from `~/.codex/AGENTS.md`. Any block referencing `softpowers-codex bootstrap` is no longer needed.

4. **Restart Codex.**

## Verify

```bash
ls -la ~/.agents/skills/using-softpowers
```

You should see a symlink (or junction on Windows) pointing to the
`using-softpowers` skill directory.

## Updating

```bash
cd ~/.codex/softpowers && git pull
```

Skills update instantly through the symlinks.

## Uninstalling

```bash
find ~/.codex/softpowers/skills -mindepth 1 -maxdepth 1 -type d -exec sh -c 'rm -f "$HOME/.agents/skills/$(basename "$1")"' _ {} \;
```

Optionally delete the clone: `rm -rf ~/.codex/softpowers`.
