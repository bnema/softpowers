#!/usr/bin/env bash
# Setup script for OpenCode plugin tests
# Creates an isolated test environment with proper plugin installation
set -euo pipefail

# Get the repository root (two levels up from tests/opencode/)
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Create temp home directory for isolation
export TEST_HOME
TEST_HOME=$(mktemp -d)
export HOME="$TEST_HOME"
export XDG_CONFIG_HOME="$TEST_HOME/.config"
export OPENCODE_CONFIG_DIR="$TEST_HOME/.config/opencode"

# Standard install layout:
#   $OPENCODE_CONFIG_DIR/softpowers/             ← package root
#   $OPENCODE_CONFIG_DIR/softpowers/skills/      ← skills dir (../../skills from plugin)
#   $OPENCODE_CONFIG_DIR/softpowers/.opencode/plugins/softpowers.js ← plugin file
#   $OPENCODE_CONFIG_DIR/plugins/softpowers.js   ← symlink OpenCode reads

SOFTPOWERS_DIR="$OPENCODE_CONFIG_DIR/softpowers"
SOFTPOWERS_SKILLS_DIR="$SOFTPOWERS_DIR/skills"
SOFTPOWERS_PLUGIN_FILE="$SOFTPOWERS_DIR/.opencode/plugins/softpowers.js"
SOFTPOWERS_TUI_PLUGIN_FILE="$SOFTPOWERS_DIR/.opencode/plugins/softpowers-tui.tsx"
SOFTPOWERS_BRANCH_REVIEW_DIR="$SOFTPOWERS_DIR/.opencode/plugins/branch-review"
SOFTPOWERS_NODE_MODULES_DIR="$SOFTPOWERS_DIR/node_modules"

# Install skills
mkdir -p "$SOFTPOWERS_DIR"
cp -r "$REPO_ROOT/skills" "$SOFTPOWERS_DIR/"

# Install plugin
mkdir -p "$(dirname "$SOFTPOWERS_PLUGIN_FILE")"
cp "$REPO_ROOT/.opencode/plugins/softpowers.js" "$SOFTPOWERS_PLUGIN_FILE"
cp "$REPO_ROOT/.opencode/plugins/softpowers-tui.tsx" "$SOFTPOWERS_TUI_PLUGIN_FILE"
cp -R "$REPO_ROOT/.opencode/plugins/branch-review" "$SOFTPOWERS_DIR/.opencode/plugins/"
mkdir -p "$SOFTPOWERS_NODE_MODULES_DIR"
cp -R "$REPO_ROOT/node_modules/local-pr-review-server" "$SOFTPOWERS_NODE_MODULES_DIR/"

# Register plugin via symlink (what OpenCode actually reads)
mkdir -p "$OPENCODE_CONFIG_DIR/plugins"
ln -sf "$SOFTPOWERS_PLUGIN_FILE" "$OPENCODE_CONFIG_DIR/plugins/softpowers.js"
ln -sf "$SOFTPOWERS_TUI_PLUGIN_FILE" "$OPENCODE_CONFIG_DIR/plugins/softpowers-tui.tsx"

cat > "$OPENCODE_CONFIG_DIR/tui.json" <<'EOF'
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [["./plugins/softpowers-tui.tsx", {}]]
}
EOF

# Create test skills in different locations for testing

# Personal test skill
mkdir -p "$OPENCODE_CONFIG_DIR/skills/personal-test"
cat > "$OPENCODE_CONFIG_DIR/skills/personal-test/SKILL.md" <<'EOF'
---
name: personal-test
description: Test personal skill for verification
---
# Personal Test Skill

This is a personal skill used for testing.

PERSONAL_SKILL_MARKER_12345
EOF

# Create a project directory for project-level skill tests
mkdir -p "$TEST_HOME/test-project/.opencode/skills/project-test"
cat > "$TEST_HOME/test-project/.opencode/skills/project-test/SKILL.md" <<'EOF'
---
name: project-test
description: Test project skill for verification
---
# Project Test Skill

This is a project skill used for testing.

PROJECT_SKILL_MARKER_67890
EOF

echo "Setup complete: $TEST_HOME"
echo "OPENCODE_CONFIG_DIR:  $OPENCODE_CONFIG_DIR"
echo "Softpowers dir:      $SOFTPOWERS_DIR"
echo "Skills dir:           $SOFTPOWERS_SKILLS_DIR"
echo "Plugin file:          $SOFTPOWERS_PLUGIN_FILE"
echo "TUI plugin file:      $SOFTPOWERS_TUI_PLUGIN_FILE"
echo "Branch review dir:    $SOFTPOWERS_BRANCH_REVIEW_DIR"
echo "Node modules dir:     $SOFTPOWERS_NODE_MODULES_DIR"
echo "Plugin registered at: $OPENCODE_CONFIG_DIR/plugins/softpowers.js"
echo "TUI symlink at:       $OPENCODE_CONFIG_DIR/plugins/softpowers-tui.tsx"
echo "Test project at:      $TEST_HOME/test-project"

# Helper function for cleanup (call from tests or trap)
cleanup_test_env() {
    if [ -n "${TEST_HOME:-}" ] && [ -d "$TEST_HOME" ]; then
        rm -rf "$TEST_HOME"
    fi
}

# Export for use in tests
export -f cleanup_test_env
export REPO_ROOT
export SOFTPOWERS_DIR
export SOFTPOWERS_SKILLS_DIR
export SOFTPOWERS_PLUGIN_FILE
export SOFTPOWERS_TUI_PLUGIN_FILE
export SOFTPOWERS_NODE_MODULES_DIR
