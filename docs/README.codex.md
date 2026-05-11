# Softpowers for Codex

Guide for using Softpowers with OpenAI Codex via native skill discovery.

## Quick Install

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/bnema/softpowers/refs/heads/main/.codex/INSTALL.md
```

## Manual Installation

### Prerequisites

- OpenAI Codex CLI
- Git

### Steps

1. Clone the repo:
   ```bash
   git clone https://github.com/bnema/softpowers.git ~/.codex/softpowers
   ```

2. Create the skills symlink:
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/softpowers/skills ~/.agents/skills/softpowers
   ```

3. Restart Codex.

4. **For subagent skills** (optional): Skills like `dispatching-parallel-agents` and `subagent-driven-development` require Codex's multi-agent feature. Add to your Codex config:
   ```toml
   [features]
   multi_agent = true
   ```

### Windows

Use a junction instead of a symlink (works without Developer Mode):

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
cmd /c mklink /J "$env:USERPROFILE\.agents\skills\softpowers" "$env:USERPROFILE\.codex\softpowers\skills"
```

## How It Works

Codex has native skill discovery. It scans `~/.agents/skills/` at startup, parses SKILL.md frontmatter, and loads skills on demand. Softpowers skills are made visible through a single symlink:

```
~/.agents/skills/softpowers/ → ~/.codex/softpowers/skills/
```

The `using-softpowers` skill is discovered automatically and enforces skill usage discipline. No additional configuration needed.

## Usage

Skills are discovered automatically. Codex activates them when:
- You mention a skill by name (e.g., "use brainstorming")
- The task matches a skill's description
- The `using-softpowers` skill directs Codex to use one

### Personal Skills

Create your own skills in `~/.agents/skills/`:

```bash
mkdir -p ~/.agents/skills/my-skill
```

Create `~/.agents/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Use when [condition] - [what it does]
---

# My Skill

[Your skill content here]
```

The `description` field is how Codex decides when to activate a skill automatically. Write it as a clear trigger condition.

## Updating

```bash
cd ~/.codex/softpowers && git pull
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/softpowers
```

**Windows (PowerShell):**
```powershell
Remove-Item "$env:USERPROFILE\.agents\skills\softpowers"
```

Optionally delete the clone: `rm -rf ~/.codex/softpowers` (Windows: `Remove-Item -Recurse -Force "$env:USERPROFILE\.codex\softpowers"`).

## Troubleshooting

### Skills not showing up

1. Verify the symlink: `ls -la ~/.agents/skills/softpowers`
2. Check skills exist: `ls ~/.codex/softpowers/skills`
3. Restart Codex. Skills are discovered at startup

### Windows junction issues

Junctions normally work without special permissions. If creation fails, try running PowerShell as administrator.

## Getting Help

- Report issues: https://github.com/bnema/softpowers/issues
- Main documentation: https://github.com/bnema/softpowers
