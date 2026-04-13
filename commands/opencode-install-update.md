---
description: "Guide OpenCode install or refresh for this Superpowers fork"
---

For OpenCode install or update questions, read these docs from this repo before answering:

- `.opencode/INSTALL.md`
- `docs/README.opencode.md`

Use this fork's docs and plugin spec by default:

- Repo docs: `https://github.com/bnema/superpowers/blob/main/docs/README.opencode.md`
- Raw install doc: `https://raw.githubusercontent.com/bnema/superpowers/refs/heads/main/.opencode/INSTALL.md`
- Plugin spec: `superpowers@git+https://github.com/bnema/superpowers.git`

When the user already has OpenCode configured:

1. Read `~/.config/opencode/opencode.json` and project `opencode.json` files if relevant.
2. Find the configured Superpowers plugin spec.
3. Explain that OpenCode caches git plugins under `~/.cache/opencode/packages/<sanitized-spec>` and does not re-pull the same git spec just because OpenCode restarted.
4. Print the exact cache directory for that spec.
5. Tell the user to remove that cached directory, then restart OpenCode.

For the default fork spec, the refresh command is:

```bash
rm -rf ~/.cache/opencode/packages/superpowers@git+https:/github.com/bnema/superpowers.git
```

Do not point users to `obra/superpowers` docs unless their configured plugin spec actually uses that upstream repo.
