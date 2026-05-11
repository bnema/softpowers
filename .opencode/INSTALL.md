# Installing Softpowers for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add softpowers to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["softpowers@git+https://github.com/bnema/softpowers.git"]
}
```

Restart OpenCode. That's it. The plugin auto-installs and registers all skills.

Verify by asking: "Tell me about your softpowers"

## Migrating from the old symlink-based install

If you previously installed softpowers using `git clone` and symlinks, remove the old setup:

```bash
# Remove old symlinks
rm -f ~/.config/opencode/plugins/softpowers.js
rm -rf ~/.config/opencode/skills/softpowers

# Optionally remove the cloned repo
rm -rf ~/.config/opencode/softpowers

# Remove skills.paths from opencode.json if you added one for softpowers
```

Then follow the installation steps above.

## Usage

Use OpenCode's native `skill` tool:

```
use skill tool to list skills
use skill tool to load softpowers/brainstorming
```

## Updating

OpenCode caches git plugins under `~/.cache/opencode/packages/`. Restarting OpenCode does not force a fresh pull for the same git plugin spec.

On Unix, the cached path mirrors the plugin spec. That means git URL slashes become nested directories under `~/.cache/opencode/packages/`, so the example below is correct even though it looks like `https:/github.com/...` at first glance.

To refresh this forked plugin, remove the cached package directory for the configured spec, then restart OpenCode:

```bash
rm -rf ~/.cache/opencode/packages/softpowers@git+https:/github.com/bnema/softpowers.git
```

If you use a different repo, branch, or tag in your plugin spec, clear the matching cache directory for that exact spec.

To pin a specific version:

```json
{
  "plugin": ["softpowers@git+https://github.com/bnema/softpowers.git#v5.0.3"]
}
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i softpowers`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Skills not found

1. Use `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

### Tool mapping

When skills reference Claude Code tools:
- `TodoWrite` → `todowrite`
- `Task` with subagents → `@mention` syntax
- `Skill` tool → OpenCode's native `skill` tool
- File operations → your native tools

## Getting Help

- Report issues: https://github.com/bnema/softpowers/issues
- Full documentation: https://github.com/bnema/softpowers/blob/main/docs/README.opencode.md
