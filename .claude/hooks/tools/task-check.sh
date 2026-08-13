#!/usr/bin/env bash
# Task-check hook for Fence repos.
# Adapted from Nick Tune's claude-skillz/task-check, wired using the same
# log/Stop pattern as automatic-code-review.sh, but tracked independently
# (any file, not just ts/tsx) since a task can be "done" via config, SQL,
# or markdown changes too.
# PostToolUse (log mode): records each modified file to a session log.
# Stop (check mode): forces a task-check subagent pass if files were modified.

set -euo pipefail

MODE="${1:-}"
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SETTINGS_FILE="${PLUGIN_ROOT}/settings.json"

is_enabled() {
  python3 -c "
import json,sys
try:
  with open('${SETTINGS_FILE}') as f:
    d=json.load(f)
  print('true' if d.get('taskCheck',{}).get('enabled',True) else 'false')
except:
  print('true')
" 2>/dev/null || echo "true"
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

  LOG_FILE="/tmp/fence-taskcheck-log-${SESSION_ID}.jsonl"
  echo "{\"event\":\"file_modified\",\"file\":\"${FILE_PATH}\",\"ts\":$(date +%s)}" >> "$LOG_FILE"
  exit 0
fi

if [ "$MODE" = "check" ]; then
  INPUT=$(cat)
  SESSION_ID=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null || echo "")
  [ -z "$SESSION_ID" ] && exit 0

  ENABLED=$(is_enabled)
  [ "$ENABLED" = "false" ] && exit 0

  LOG_FILE="/tmp/fence-taskcheck-log-${SESSION_ID}.jsonl"
  [ ! -f "$LOG_FILE" ] && exit 0

  # Only trigger once per Stop cycle worth of changes.
  LAST_CHECK_TS=$(grep '"event":"check_triggered"' "$LOG_FILE" 2>/dev/null | tail -1 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ts',0))" 2>/dev/null || echo "0")

  MODIFIED_FILES=$(python3 -c "
import json, sys
last_ts = ${LAST_CHECK_TS}
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

  echo "{\"event\":\"check_triggered\",\"ts\":$(date +%s)}" >> "$LOG_FILE"

  cat >&2 <<EOF

📋 TASK CHECK REQUIRED

Files modified this session:
$(echo "$MODIFIED_FILES" | sed 's/^/  - /')

INSTRUCTION: If this session's work maps to a discrete checklist item or task
(most sessions do — this build has no informal "just poking around" carve-out
for anything that touches product code), use the Task tool with subagent_type
"task-check" before finishing. Supply:
  - The checklist item reference (e.g. "fence-checklist-phase-1.md, item 1.5.3")
    or a plain task description if none applies
  - A work summary in your own words
  - Attempt number (1 on first run)

On FAIL: fix FIX_NOW issues yourself, surface ASK_USER issues to the user, then
re-run with attempt+1 (max 3) before considering the task done. Do not open or
merge a PR on a FAIL.

If this was genuinely exploratory/conversational work with no discrete
deliverable (e.g. answering a question, reading code), skip this.
EOF

  exit 2
fi

exit 0
