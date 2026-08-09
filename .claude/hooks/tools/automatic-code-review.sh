#!/usr/bin/env bash
# Automatic code review hook for Fence repos.
# Adapted from doc-e-sign's automatic-code-review.sh (hermeticsign/app),
# itself adapted from Nick Tune's claude-skillz/automatic-code-review.
# PostToolUse (log mode): records each modified file to a session log.
# Stop (review mode): triggers the automatic-code-reviewer subagent if files were modified.

set -euo pipefail

MODE="${1:-}"
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SETTINGS_FILE="${PLUGIN_ROOT}/settings.json"

get_session_id() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null || echo ""
}

get_file_path() {
  python3 -c "
import json,sys
d=json.load(sys.stdin)
inp=d.get('tool_input',{})
print(inp.get('file_path', inp.get('path', '')))
" 2>/dev/null || echo ""
}

get_tool_name() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo ""
}

is_enabled() {
  python3 -c "
import json,sys
try:
  with open('${SETTINGS_FILE}') as f:
    d=json.load(f)
  print('true' if d.get('automaticCodeReview',{}).get('enabled',True) else 'false')
except:
  print('true')
" 2>/dev/null || echo "true"
}

get_file_extensions() {
  python3 -c "
import json,sys
try:
  with open('${SETTINGS_FILE}') as f:
    d=json.load(f)
  exts=d.get('automaticCodeReview',{}).get('fileExtensions',['ts','tsx'])
  print(','.join(exts))
except:
  print('ts,tsx')
" 2>/dev/null || echo "ts,tsx"
}

if [ "$MODE" = "log" ]; then
  INPUT=$(cat)
  SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null || echo "")
  FILE_PATH=$(echo "$INPUT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
inp=d.get('tool_input',{})
print(inp.get('file_path', inp.get('path', '')))
" 2>/dev/null || echo "")

  [ -z "$SESSION_ID" ] && exit 0
  [ -z "$FILE_PATH" ] && exit 0

  ENABLED=$(is_enabled)
  [ "$ENABLED" = "false" ] && exit 0

  EXT="${FILE_PATH##*.}"
  ALLOWED_EXTS=$(get_file_extensions)
  if ! echo "$ALLOWED_EXTS" | tr ',' '\n' | grep -qx "$EXT"; then
    exit 0
  fi

  LOG_FILE="/tmp/fence-review-log-${SESSION_ID}.jsonl"
  echo "{\"event\":\"file_modified\",\"file\":\"${FILE_PATH}\",\"ts\":$(date +%s)}" >> "$LOG_FILE"
  exit 0
fi

if [ "$MODE" = "review" ]; then
  INPUT=$(cat)
  SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null || echo "")
  [ -z "$SESSION_ID" ] && exit 0

  ENABLED=$(is_enabled)
  [ "$ENABLED" = "false" ] && exit 0

  LOG_FILE="/tmp/fence-review-log-${SESSION_ID}.jsonl"
  [ ! -f "$LOG_FILE" ] && exit 0

  # Find files modified since the last review_triggered event
  LAST_REVIEW_TS=$(grep '"event":"review_triggered"' "$LOG_FILE" 2>/dev/null | tail -1 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ts',0))" 2>/dev/null || echo "0")

  MODIFIED_FILES=$(python3 -c "
import json, sys
last_ts = ${LAST_REVIEW_TS}
files = set()
try:
  with open('${LOG_FILE}') as f:
    for line in f:
      try:
        d = json.loads(line.strip())
        if d.get('event') == 'file_modified' and d.get('ts', 0) > last_ts:
          files.add(d['file'])
      except:
        pass
except:
  pass
print('\n'.join(sorted(files)))
" 2>/dev/null || echo "")

  [ -z "$MODIFIED_FILES" ] && exit 0

  # Log that review is being triggered
  echo "{\"event\":\"review_triggered\",\"ts\":$(date +%s)}" >> "$LOG_FILE"

  FILE_LIST=$(echo "$MODIFIED_FILES" | tr '\n' ' ')

  # Run tsc and capture any type errors to include in the review prompt.
  TSC_OUTPUT=$(cd "$(git rev-parse --show-toplevel)" && npx tsc --noEmit 2>&1 || true)
  if [ -n "$TSC_OUTPUT" ]; then
    TSC_SECTION="

TypeScript errors found by tsc --noEmit (fix these too):
${TSC_OUTPUT}"
  else
    TSC_SECTION=""
  fi

  cat >&2 <<EOF

📋 CODE REVIEW REQUIRED

Files modified since last review:
$(echo "$MODIFIED_FILES" | sed 's/^/  - /')

INSTRUCTION: Use the Task tool with subagent_type "automatic-code-reviewer".
Pass the following file list as the prompt:

Review these files against the project conventions:
${FILE_LIST}
${TSC_SECTION}
Show ALL findings to the user. Fix every violation found before considering the task complete.
Unless a fix would genuinely conflict with the requirements, or make the code meaningfully worse,
fix it — do not skip for reasons like "pre-existing", "out of scope", or "minor".
EOF

  exit 2
fi

exit 0
