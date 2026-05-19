# Softpowers for Codex

Softpowers supports Codex as a local plugin. The plugin manifest keeps the
skills grouped and namespaced as `softpowers:*`, while a reusable local
marketplace lets Codex install and enable this plugin without publishing this
fork to a public marketplace.

## Recommended Local Install

Clone this fork into Codex's plugin area:

```bash
git clone https://github.com/bnema/softpowers.git ~/.codex/plugins/softpowers
```

Create or update a local marketplace that points at the plugin:

```bash
mkdir -p ~/.codex/marketplaces/local/.agents/plugins
mkdir -p ~/.codex/marketplaces/local/plugins
ln -sfn ~/.codex/plugins/softpowers ~/.codex/marketplaces/local/plugins/softpowers

cat > ~/.codex/marketplaces/local/.agents/plugins/marketplace.json <<'JSON'
{
  "name": "local-codex",
  "interface": {
    "displayName": "Local Codex Plugins"
  },
  "plugins": [
    {
      "name": "softpowers",
      "source": {
        "source": "local",
        "path": "./plugins/softpowers"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Coding"
    }
  ]
}
JSON
```

Register the marketplace:

```bash
codex plugin marketplace add ~/.codex/marketplaces/local
```

In the Codex app or TUI, the same value goes in the **Add marketplace** prompt.
If `~` is not expanded there, enter the absolute path to your home directory's
`.codex/marketplaces/local` folder.

This marketplace is intentionally plugin-agnostic. You can add more local
plugins later by adding entries to the same `plugins` array and placing each
plugin under `~/.codex/marketplaces/local/plugins/`.

Then open Codex, run `/plugins`, choose **Local Codex Plugins**, and install and
enable **Softpowers**. Restart Codex after enabling the plugin so new sessions
load the skills.

If you prefer direct config, add:

```toml
[plugins."softpowers@local-codex"]
enabled = true
```

### Windows PowerShell

```powershell
git clone https://github.com/bnema/softpowers.git "$env:USERPROFILE\.codex\plugins\softpowers"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.codex\marketplaces\local\.agents\plugins"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.codex\marketplaces\local\plugins"

$pluginLink = "$env:USERPROFILE\.codex\marketplaces\local\plugins\softpowers"
if (Test-Path $pluginLink) { Remove-Item $pluginLink -Force -Recurse }
cmd /c mklink /J "$pluginLink" "$env:USERPROFILE\.codex\plugins\softpowers"

$marketplaceJson = @'
{
  "name": "local-codex",
  "interface": {
    "displayName": "Local Codex Plugins"
  },
  "plugins": [
    {
      "name": "softpowers",
      "source": {
        "source": "local",
        "path": "./plugins/softpowers"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Coding"
    }
  ]
}
'@

$marketplacePath = "$env:USERPROFILE\.codex\marketplaces\local\.agents\plugins\marketplace.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($marketplacePath, $marketplaceJson, $utf8NoBom)

codex plugin marketplace add "$env:USERPROFILE\.codex\marketplaces\local"
```

Then install and enable **Softpowers** from `/plugins`.

## Repository Instructions

Codex automatically reads `AGENTS.md` from the repository root. Keep that file
as the primary project instruction file for Codex and other agent harnesses.

If you want Codex to treat another filename as a project instruction file, add
it as a fallback filename in `~/.codex/config.toml`:

```toml
project_doc_fallback_filenames = ["TEAM_GUIDE.md"]
```

Do not rely on alternate filenames as default Codex discovery files.

## Verify

```bash
codex --version
codex debug prompt-input "help me plan this feature" | grep "softpowers:using-softpowers"
```

Then open a new Codex session and ask for something skill-shaped:

```text
help me plan this feature
```

Codex should list **Softpowers** as an enabled plugin and expose skills such as
`softpowers:using-softpowers`, `softpowers:brainstorming`, and
`softpowers:test-driven-development`.

## Updating

```bash
cd ~/.codex/plugins/softpowers
git pull
```

Restart Codex after updating. If plugin metadata appears stale, open `/plugins`,
reinstall or toggle **Softpowers**, then restart Codex again.

## Why a Local Marketplace?

Codex can read standalone skills from `.agents/skills` and `~/.agents/skills`,
but Softpowers is a bundle of related skills with a `.codex-plugin/plugin.json`
manifest. Installing it as a plugin keeps the skills grouped under the
`softpowers:` namespace and matches how Codex presents plugin capabilities in
the app and CLI.

The local marketplace is only a small manifest that tells Codex where local
plugin checkouts live. It should stay plugin-agnostic: Softpowers is one entry
inside the marketplace, not the marketplace itself. The plugin content remains a
Git checkout under `~/.codex/plugins/softpowers`, so updating stays simple.

## Notes for Maintainers

- `.codex-plugin/plugin.json` describes the plugin shape for Codex plugin
  workflows.
- `skills/using-softpowers/references/codex-tools.md` is the compatibility map
  for translating Claude Code-oriented skill instructions into Codex tools.
- The sync workflow was adapted from upstream Superpowers and now targets the
  Softpowers plugin path by default.
