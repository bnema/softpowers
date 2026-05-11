# Installing Softpowers for Codex

Enable softpowers skills in Codex via native skill discovery. Just clone and symlink.

## Prerequisites

- Git

## Installation

1. **Clone the softpowers repository:**
   ```bash
   git clone https://github.com/bnema/softpowers.git ~/.codex/softpowers
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/softpowers/skills ~/.agents/skills/softpowers
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\softpowers" "$env:USERPROFILE\.codex\softpowers\skills"
   ```

3. **Restart Codex** (quit and relaunch the CLI) to discover the skills.

## Migrating from old bootstrap

If you installed softpowers before native skill discovery, you need to:

1. **Update the repo:**
   ```bash
   cd ~/.codex/softpowers && git pull
   ```

2. **Create the skills symlink** (step 2 above). This is the new discovery mechanism.

3. **Remove the old bootstrap block** from `~/.codex/AGENTS.md`. Any block referencing `softpowers-codex bootstrap` is no longer needed.

4. **Restart Codex.**

## Verify

```bash
ls -la ~/.agents/skills/softpowers
```

You should see a symlink (or junction on Windows) pointing to your softpowers skills directory.

## Updating

```bash
cd ~/.codex/softpowers && git pull
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/softpowers
```

Optionally delete the clone: `rm -rf ~/.codex/softpowers`.
