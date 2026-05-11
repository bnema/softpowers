---
description: "Guide OpenCode install or refresh for this Softpowers fork"
---

For OpenCode install or update questions, read these docs from this repo before answering:

- `.opencode/INSTALL.md`
- `docs/README.opencode.md`

Use this fork's docs and plugin spec by default:

- Repo docs: `https://github.com/bnema/softpowers/blob/main/docs/README.opencode.md`
- Raw install doc: `https://raw.githubusercontent.com/bnema/softpowers/refs/heads/main/.opencode/INSTALL.md`
- Plugin spec: `softpowers@git+https://github.com/bnema/softpowers.git`

When the user already has OpenCode configured:

1. Read `~/.config/opencode/opencode.json` and project `opencode.json` files if relevant.
2. Find the configured Softpowers plugin spec.
3. Explain that OpenCode caches git plugins under `~/.cache/opencode/packages/<plugin-spec>` on Unix and does not re-pull the same git spec just because OpenCode restarted.
4. Print the exact cache directory for that spec.
5. Tell the user to remove that cached directory, then restart OpenCode.

Because the cache path mirrors the plugin spec on Unix, git URL slashes become nested directories under `~/.cache/opencode/packages/`. The example path below is correct even though it looks like `https:/github.com/...` at first glance.

For the default fork spec, the refresh command is:

```bash
rm -rf ~/.cache/opencode/packages/softpowers@git+https:/github.com/bnema/softpowers.git
```

Do not point users to upstream Superpowers docs unless their configured plugin spec actually uses the upstream repo.
