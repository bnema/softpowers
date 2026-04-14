# Superpowers for OpenCode

Complete guide for using Superpowers with [OpenCode.ai](https://opencode.ai).

## Installation

Add superpowers to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["superpowers@git+https://github.com/bnema/superpowers.git"]
}
```

Restart OpenCode. The plugin auto-installs via Bun and registers all skills automatically.

Verify by asking: "Tell me about your superpowers"

### Migrating from the old symlink-based install

If you previously installed superpowers using `git clone` and symlinks, remove the old setup:

```bash
# Remove old symlinks
rm -f ~/.config/opencode/plugins/superpowers.js
rm -rf ~/.config/opencode/skills/superpowers

# Optionally remove the cloned repo
rm -rf ~/.config/opencode/superpowers

# Remove skills.paths from opencode.json if you added one for superpowers
```

Then follow the installation steps above.

## Usage

### Finding Skills

Use OpenCode's native `skill` tool to list all available skills:

```
use skill tool to list skills
```

### Loading a Skill

```
use skill tool to load superpowers/brainstorming
```

### Personal Skills

Create your own skills in `~/.config/opencode/skills/`:

```bash
mkdir -p ~/.config/opencode/skills/my-skill
```

Create `~/.config/opencode/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Use when [condition] - [what it does]
---

# My Skill

[Your skill content here]
```

### Project Skills

Create project-specific skills in `.opencode/skills/` within your project.

**Skill Priority:** Project skills > Personal skills > Superpowers skills

## Updating

OpenCode caches git plugins under `~/.cache/opencode/packages/`. Restarting OpenCode does not force a fresh pull for the same git plugin spec.

On Unix, the cached path mirrors the plugin spec. That means git URL slashes become nested directories under `~/.cache/opencode/packages/`, so the example below is correct even though it looks like `https:/github.com/...` at first glance.

To refresh this forked plugin, remove the cached package directory for the configured spec, then restart OpenCode:

```bash
rm -rf ~/.cache/opencode/packages/superpowers@git+https:/github.com/bnema/superpowers.git
```

If you use a different repo, branch, or tag in your plugin spec, clear the matching cache directory for that exact spec.

To pin a specific version, use a branch or tag:

```json
{
  "plugin": ["superpowers@git+https://github.com/bnema/superpowers.git#v5.0.3"]
}
```

## How It Works

The plugin does two things:

1. **Injects bootstrap context** via the `experimental.chat.system.transform` hook, adding superpowers awareness to every conversation.
2. **Registers the skills directory** via the `config` hook, so OpenCode discovers all superpowers skills without symlinks or manual config.

### Local branch review

In OpenCode TUI sessions, Superpowers adds a `Review branch locally` command and finish-flow option. It can also offer the local reviewer server after workspace selection and before implementation starts, so you can review while it works.

It starts a local browser review UI for the full branch diff against the detected base branch, lets you leave inline review comments, and sends the final grouped review back into the active session as one user message.

The browser draft stays local until you submit it. The TUI then refocuses the active session so you can watch the response stream immediately.

### Manual branch review session handoff

For manual reviews, the launcher prints a URL like `http://127.0.0.1:<port>/?session=<sessionID>&base=<baseRef>`.

This is a hard product constraint: the review server will not start at all without an attached OpenCode session.

That `session=<sessionID>` query parameter is still required at page load. If the review page opens without the matching session, it fails fast instead of accepting a review that cannot return to OpenCode.

### Tool Mapping

Skills written for Claude Code are automatically adapted for OpenCode:

- `TodoWrite` → `todowrite`
- `Task` with subagents → OpenCode's `@mention` system
- `Skill` tool → OpenCode's native `skill` tool
- File operations → Native OpenCode tools

## Troubleshooting

### Plugin not loading

1. Check OpenCode logs: `opencode run --print-logs "hello" 2>&1 | grep -i superpowers`
2. Verify the plugin line in your `opencode.json` is correct
3. Make sure you're running a recent version of OpenCode

### Skills not found

1. Use OpenCode's `skill` tool to list available skills
2. Check that the plugin is loading (see above)
3. Each skill needs a `SKILL.md` file with valid YAML frontmatter

### Bootstrap not appearing

1. Check OpenCode version supports `experimental.chat.system.transform` hook
2. Restart OpenCode after config changes

## Getting Help

- Report issues: https://github.com/bnema/superpowers/issues
- Main documentation: https://github.com/bnema/superpowers
- OpenCode docs: https://opencode.ai/docs/
