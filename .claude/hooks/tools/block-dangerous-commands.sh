#!/usr/bin/env bash
# Blocks git commands that bypass safety checks or are destructive.
# Triggered by PreToolUse on Bash tool calls.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('tool_input',{}).get('command',''))
" 2>/dev/null || echo "")

BLOCKED_PATTERNS=(
  "--no-verify"
  "--force-with-lease"
  "push --force"
  "push -f "
  "reset --hard"
  "checkout -- "
  "restore \."
  "clean -f"
  "branch -D"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  # -- terminates option parsing before $pattern: BSD grep (macOS's default)
  # otherwise treats a pattern starting with "--" (e.g. --no-verify) as an
  # unrecognized flag, errors out, and the match silently never fires.
  if echo "$COMMAND" | grep -q -- "$pattern"; then
    echo "Blocked: This command bypasses safety checks (matched: ${pattern})" >&2
    exit 1
  fi
done

# Block modifications to quality-gate config files
PROTECTED_FILES=(
  ".eslintrc"
  "eslint.config"
  "vitest.config"
  ".github/workflows"
)

for protected in "${PROTECTED_FILES[@]}"; do
  if echo "$COMMAND" | grep -q -- "$protected"; then
    echo "Blocked: Modifications to quality-gate configuration files require explicit approval." >&2
    exit 1
  fi
done

exit 0
