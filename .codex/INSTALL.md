# Installing Softpowers for Codex

Enable Softpowers in Codex as a local plugin. This keeps the Softpowers skills
namespaced as `softpowers:*`, avoids copying individual skills into
`~/.agents/skills`, and lets the install stay current with `git pull`.

## Prerequisites

- Git
- Codex CLI with plugin support

## Installation

1. **Clone the Softpowers repository as a Codex plugin source:**
   ```bash
   git clone https://github.com/bnema/softpowers.git ~/.codex/plugins/softpowers
   ```

2. **Create or update a local Codex marketplace:**
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

3. **Register the marketplace with Codex:**
   ```bash
   codex plugin marketplace add ~/.codex/marketplaces/local
   ```

   This marketplace can hold additional local plugins later. In the Codex app
   or TUI, the same value goes in the **Add marketplace**
   prompt. If `~` is not expanded there, enter the absolute path to your home
   directory's `.codex/marketplaces/local` folder.

4. **Install and enable the plugin:**

   Open Codex, run `/plugins`, choose **Local Codex Plugins**, then install and
   enable **Softpowers**.

   If you prefer to edit Codex config directly, add:
   ```toml
   [plugins."softpowers@local-codex"]
   enabled = true
   ```

5. **Restart Codex** so the plugin skills are loaded into new sessions.

## Windows PowerShell

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

Then open Codex, run `/plugins`, choose **Local Codex Plugins**, and install and
enable **Softpowers**.

## Migrating from old bootstrap or skill symlinks

If you installed Softpowers before the Codex plugin workflow:

1. **Install the plugin** using the steps above.

2. **Inspect old per-skill symlinks** that point into a previous Softpowers
   checkout:
   ```powershell
   # PowerShell example for old installs:
   Get-ChildItem "$env:USERPROFILE\.agents\skills" | Where-Object {
       $_.LinkType -or $_.FullName -like "*softpowers*"
   }
   ```

   On Unix-like systems, inspect before deleting:
   ```bash
   find ~/.agents/skills -maxdepth 1 -type l -ls | grep softpowers
   ```

   Remove only the old Softpowers symlinks you confirm are stale. Do not remove
   unrelated personal skills from `~/.agents/skills`.

3. **Remove the old bootstrap block** from `~/.codex/AGENTS.md` if it
   references `softpowers-codex bootstrap`.

4. **Restart Codex.**

## Verify

```bash
codex --version
codex debug prompt-input "help me plan this feature" | grep "softpowers:using-softpowers"
```

In a live Codex session, the native SessionStart hook should inject the
`softpowers:using-softpowers` bootstrap automatically, and the available skills
should include names such as `softpowers:using-softpowers`,
`softpowers:brainstorming`, and `softpowers:test-driven-development`.

## Updating

```bash
cd ~/.codex/plugins/softpowers
git pull
```

Restart Codex after updating. If the plugin metadata appears stale, open
`/plugins`, reinstall or toggle **Softpowers**, then restart Codex again.

## Uninstalling

Open `/plugins` and uninstall or disable **Softpowers**, then remove the
Softpowers plugin checkout and marketplace entry:

```bash
rm -f ~/.codex/marketplaces/local/plugins/softpowers
rm -rf ~/.codex/plugins/softpowers
```

Only remove the marketplace itself if you are not using it for any other local
plugins:

```bash
codex plugin marketplace remove local-codex
rm -rf ~/.codex/marketplaces/local
```
