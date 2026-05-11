# Pi Agent Profiles for Softpowers

This directory contains Pi-specific agent profiles used by Softpowers subagent workflows.

## Included profiles

- `code-reviewer.md`: used by `requesting-code-review` and workflows that depend on it.

## Installation

Install these profiles into your Pi user agents directory:

```bash
mkdir -p ~/.pi/agent/agents
ln -sf ~/.pi/agent/git/github.com/bnema/softpowers/.pi/agents/code-reviewer.md ~/.pi/agent/agents/code-reviewer.md
```

If Softpowers is installed from a local path, replace the source path accordingly.
