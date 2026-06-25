#!/usr/bin/env bash
# Test: Plugin Loading
# Verifies that the softpowers plugin loads correctly in OpenCode
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Test: Plugin Loading ==="

# Source setup to create isolated environment
source "$SCRIPT_DIR/setup.sh"

# Trap to cleanup on exit
trap cleanup_test_env EXIT

plugin_link="$OPENCODE_CONFIG_DIR/plugins/softpowers.js"

# Test 1: Verify plugin file exists and is registered
echo "Test 1: Checking plugin registration..."
if [ -L "$plugin_link" ]; then
    echo "  [PASS] Plugin symlink exists"
else
    echo "  [FAIL] Plugin symlink not found at $plugin_link"
    exit 1
fi

# Verify symlink target exists
if [ -f "$(readlink -f "$plugin_link")" ]; then
    echo "  [PASS] Plugin symlink target exists"
else
    echo "  [FAIL] Plugin symlink target does not exist"
    exit 1
fi

# Test 2: Verify skills directory is populated
echo "Test 2: Checking skills directory..."
skill_count=$(find "$SOFTPOWERS_SKILLS_DIR" -name "SKILL.md" | wc -l)
if [ "$skill_count" -gt 0 ]; then
    echo "  [PASS] Found $skill_count skills"
else
    echo "  [FAIL] No skills found in $SOFTPOWERS_SKILLS_DIR"
    exit 1
fi

# Test 3: Check using-softpowers skill exists (critical for bootstrap)
echo "Test 3: Checking using-softpowers skill (required for bootstrap)..."
if [ -f "$SOFTPOWERS_SKILLS_DIR/using-softpowers/SKILL.md" ]; then
    echo "  [PASS] using-softpowers skill exists"
else
    echo "  [FAIL] using-softpowers skill not found (required for bootstrap)"
    exit 1
fi

# Test 4: Verify plugin JavaScript syntax (basic check)
echo "Test 4: Checking plugin JavaScript syntax..."
if node --check "$SOFTPOWERS_PLUGIN_FILE" 2>/dev/null; then
    echo "  [PASS] Plugin JavaScript syntax is valid"
else
    echo "  [FAIL] Plugin has JavaScript syntax errors"
    exit 1
fi

# Test 5: Verify bootstrap text does not reference a hardcoded skills path
echo "Test 5: Checking bootstrap does not advertise a wrong skills path..."
if grep -q 'configDir}/skills/softpowers/' "$SOFTPOWERS_PLUGIN_FILE"; then
  echo "  [FAIL] Plugin still references old configDir skills path"
  exit 1
else
  echo "  [PASS] Plugin does not advertise a misleading skills path"
fi

removed_package='local-pr-review-'"server"
removed_handoff_pattern='local branch review[[:space:]-]+server|review[[:space:]-]+server|'"$removed_package"

echo "Test 5b: Checking removed browser handoff docs are absent..."
if ! grep -RqiE "$removed_handoff_pattern" "$REPO_ROOT/README.md" "$REPO_ROOT/.opencode/INSTALL.md" "$REPO_ROOT/commands"; then
  echo "  [PASS] OpenCode-facing docs do not mention the removed browser handoff"
else
  echo "  [FAIL] OpenCode-facing docs still mention the removed browser handoff"
  exit 1
fi

echo "Test 5c: Checking OpenCode update guidance..."
if grep -q "updates automatically when you restart OpenCode" "$REPO_ROOT/README.md" "$REPO_ROOT/.opencode/INSTALL.md"; then
  echo "  [FAIL] OpenCode docs still claim restart auto-updates the plugin"
  exit 1
else
  echo "  [PASS] OpenCode docs describe the real refresh flow"
fi

echo "Test 5d: Checking OpenCode helper command..."
if [ -f "$REPO_ROOT/commands/opencode-install-update.md" ] \
  && grep -q "docs/README.opencode.md" "$REPO_ROOT/commands/opencode-install-update.md" \
  && grep -q "~/.cache/opencode/packages" "$REPO_ROOT/commands/opencode-install-update.md" \
  && grep -q "bnema/softpowers" "$REPO_ROOT/commands/opencode-install-update.md"; then
  echo "  [PASS] OpenCode helper command exists and points to fork docs"
else
  echo "  [FAIL] OpenCode helper command is missing or incomplete"
  exit 1
fi

echo "Test 5e: Checking OpenCode refresh path explanation..."
if grep -q "git URL slashes become nested directories" "$REPO_ROOT/.opencode/INSTALL.md" \
  && grep -q "git URL slashes become nested directories" "$REPO_ROOT/commands/opencode-install-update.md"; then
  echo "  [PASS] OpenCode docs explain the cache path shape"
else
  echo "  [FAIL] OpenCode docs do not explain why the cache path looks truncated"
  exit 1
fi

echo "Test 5f: Checking removed browser handoff session docs are absent..."
if ! grep -Rqi "session=<sessionID>" "$REPO_ROOT/README.md" "$REPO_ROOT/.opencode/INSTALL.md" "$REPO_ROOT/commands"; then
  echo "  [PASS] OpenCode-facing docs do not mention removed browser handoff session handoff"
else
  echo "  [FAIL] OpenCode-facing docs still mention removed browser handoff session handoff"
  exit 1
fi

echo "Test 5g: Checking removed browser handoff skill is absent..."
removed_skill_dir="$SOFTPOWERS_SKILLS_DIR/local-""branch""-review"
if [ ! -e "$removed_skill_dir/SKILL.md" ] \
  && [ ! -e "$removed_skill_dir/review-""start.cjs" ] \
  && [ ! -e "$removed_skill_dir/review-""stop.cjs" ]; then
  echo "  [PASS] removed browser handoff skill files are absent"
else
  echo "  [FAIL] removed browser handoff skill files still exist"
  exit 1
fi

echo "Test 6: Checking TUI plugin surface..."
if grep -q '"./tui"' "$REPO_ROOT/package.json"; then
  echo "  [PASS] package exports a TUI entrypoint"
else
  echo "  [FAIL] package.json is missing ./tui export"
  exit 1
fi

if [ -L "$OPENCODE_CONFIG_DIR/plugins/softpowers-tui.tsx" ] && [ "$(readlink -f "$OPENCODE_CONFIG_DIR/plugins/softpowers-tui.tsx")" = "$SOFTPOWERS_TUI_PLUGIN_FILE" ]; then
  echo "  [PASS] TUI plugin symlink points at installed package copy"
else
  echo "  [FAIL] TUI plugin symlink missing or incorrect"
  exit 1
fi

echo "Test 7: Checking root plugin helper is absent..."
if [ -e "$REPO_ROOT/.opencode/plugins/review-shared.js" ]; then
  echo "  [FAIL] Root plugin helper still exists at .opencode/plugins/review-shared.js"
  exit 1
else
  echo "  [PASS] Root plugin helper has been moved out of the plugin scan path"
fi

echo "Test 8: Checking removed browser handoff integration files are absent..."
removed_branch_dir="$SOFTPOWERS_DIR/.opencode/plugins/branch-""review"
if [ ! -e "$removed_branch_dir" ] \
  && [ ! -e "$SOFTPOWERS_DIR/node_modules/$removed_package" ]; then
  echo "  [PASS] Installed package has no removed browser handoff integration files"
else
  echo "  [FAIL] Installed package still includes removed browser handoff integration files"
  exit 1
fi

echo "Test 9: Checking TUI plugin config..."
if [ -f "$OPENCODE_CONFIG_DIR/tui.json" ] && grep -q "softpowers-tui.tsx" "$OPENCODE_CONFIG_DIR/tui.json"; then
  echo "  [PASS] TUI plugin config exists"
else
  echo "  [FAIL] TUI plugin config missing"
  exit 1
fi

# Test 10: Verify personal test skill was created
echo "Test 10: Checking test fixtures..."
if [ -f "$OPENCODE_CONFIG_DIR/skills/personal-test/SKILL.md" ]; then
    echo "  [PASS] Personal test skill fixture created"
else
  echo "  [FAIL] Personal test skill fixture not found"
  exit 1
fi

echo ""
echo "=== All plugin loading tests passed ==="
