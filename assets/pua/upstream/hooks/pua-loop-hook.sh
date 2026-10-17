#!/bin/bash

# PUA Loop Stop Hook — with autoresearch-style Gate Protocol
# Prevents session exit when a pua-loop is active
# Feeds Claude's output back as input to continue the loop
#
# Gate Protocol (inspired by autoresearch):
#   Phase 1: Claude self-reports via <promise> tag (in-prompt)
#   Phase 2: Hook runs verify_command independently (Oracle Isolation)
#   If Phase 2 fails → promise REJECTED → loop continues
#
# Adapted from Ralph Wiggum by Anthropic (MIT License)
# https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum

set -euo pipefail
command -v jq &>/dev/null || { echo "jq not found, skipping" >&2; exit 0; }

# Portable timeout wrapper. macOS does not ship GNU `timeout`; Homebrew may
# provide `gtimeout`, and Perl is available by default on macOS/Linux.
run_with_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$seconds" "$@"
  else
    perl -e '
      my $seconds = shift @ARGV;
      $SIG{ALRM} = sub { exit 124 };
      alarm($seconds);
      exec @ARGV;
    ' "$seconds" "$@"
  fi
}

HOOK_INPUT=$(cat)

# ═══════════════════════════════════════════════════════════════
# Gate 0 — Defensive Subagent Isolation
#
# Claude Code reality: the Stop hook fires only for the main session; subagents go
# through the separate SubagentStop event registration, and `parent_session_id`
# does not exist in the Stop payload. The check below is dead code in the current
# version; **keeping it is defensive programming** - if dispatch behavior changes
# later, this gate catches the regression.
# When jq fails (invalid JSON) it returns an empty string without tripping set -e,
# which is equivalent to fail-open, but the later state-file parse re-validates,
# so the combination cannot be hijacked.
# ═══════════════════════════════════════════════════════════════
HOOK_EVENT=$(echo "$HOOK_INPUT" | jq -r '.hook_event_name // ""' 2>/dev/null || echo "")
PARENT_SESSION=$(echo "$HOOK_INPUT" | jq -r '.parent_session_id // ""' 2>/dev/null || echo "")
if [[ "$HOOK_EVENT" == "SubagentStop" ]] || [[ -n "$PARENT_SESSION" ]]; then
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# State file resolution (v3.2)
# Named by cwd hash: $HOME/.claude/pua/loop-<hash>.md (independent per project directory)
# Compatible with the v3.1 single file loop-active.md (checks started_cwd match)
# Compatible with legacy .claude/pua-loop.local.md
# ═══════════════════════════════════════════════════════════════
HOOK_SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
PUA_DIR="${HOME}/.claude/pua"
CWD_HASH=$(printf '%s' "$(pwd)" | md5sum 2>/dev/null | cut -c1-8 || printf '%s' "$(pwd)" | md5 2>/dev/null | cut -c1-8 || echo "default")
ABS_STATE_FILE="${PUA_DIR}/loop-${CWD_HASH}.md"
LEGACY_ABS_STATE_FILE="${PUA_DIR}/loop-active.md"
LEGACY_STATE_FILE=".claude/pua-loop.local.md"

if [[ -f "$ABS_STATE_FILE" ]]; then
  RALPH_STATE_FILE="$ABS_STATE_FILE"
elif [[ -f "$LEGACY_ABS_STATE_FILE" ]]; then
  # v3.1 compatibility: old single file; check whether started_cwd matches the current directory
  LEGACY_CWD=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$LEGACY_ABS_STATE_FILE" | grep '^started_cwd:' | sed 's/started_cwd: *//' | sed 's/^"\(.*\)"$/\1/' || true)
  if [[ "$LEGACY_CWD" == "$(pwd)" ]] || [[ -z "$LEGACY_CWD" ]]; then
    RALPH_STATE_FILE="$LEGACY_ABS_STATE_FILE"
  elif [[ -f "$LEGACY_STATE_FILE" ]]; then
    RALPH_STATE_FILE="$LEGACY_STATE_FILE"
  else
    exit 0
  fi
elif [[ -f "$LEGACY_STATE_FILE" ]]; then
  RALPH_STATE_FILE="$LEGACY_STATE_FILE"
else
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# Stale lock detection
# An mtime older than 30min counts as an orphan state (previous session crashed, subagent leftover); clean up and exit.
# macOS uses stat -f %m, Linux uses stat -c %Y, fallback 0.
# ═══════════════════════════════════════════════════════════════
MTIME=$(stat -f %m "$RALPH_STATE_FILE" 2>/dev/null || stat -c %Y "$RALPH_STATE_FILE" 2>/dev/null || echo 0)
NOW=$(date +%s)
if [[ "$MTIME" =~ ^[0-9]+$ ]] && [[ $((NOW - MTIME)) -gt 1800 ]]; then
  echo "🧹 PUA Loop: state file stale (>30min idle), reaping orphan" >&2
  echo "{\"status\":\"orphan_reaped\",\"state_file\":\"$RALPH_STATE_FILE\",\"age_sec\":$((NOW - MTIME)),\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> "${PUA_DIR}/loop-history.jsonl" 2>/dev/null || \
    echo "{\"status\":\"orphan_reaped\",\"state_file\":\"$RALPH_STATE_FILE\",\"age_sec\":$((NOW - MTIME)),\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> .claude/pua-loop-history.jsonl 2>/dev/null || true
  rm -f "$RALPH_STATE_FILE"
  exit 0
fi

# Normalize CRLF
TEMP_NORM="${RALPH_STATE_FILE}.norm.$$"
tr -d '\r' < "$RALPH_STATE_FILE" > "$TEMP_NORM" && mv "$TEMP_NORM" "$RALPH_STATE_FILE"

# Parse frontmatter
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$RALPH_STATE_FILE" | tr -d '\r')
LOOP_ACTIVE=$(echo "$FRONTMATTER" | grep '^active:' | sed 's/active: *//' || true)
ITERATION=$(echo "$FRONTMATTER" | grep '^iteration:' | sed 's/iteration: *//' || true)
MAX_ITERATIONS=$(echo "$FRONTMATTER" | grep '^max_iterations:' | sed 's/max_iterations: *//' || true)
COMPLETION_PROMISE=$(echo "$FRONTMATTER" | grep '^completion_promise:' | sed 's/completion_promise: *//' | sed 's/^"\(.*\)"$/\1/' || true)
VERIFY_CMD=$(echo "$FRONTMATTER" | grep '^verify_command:' | sed 's/verify_command: *//' | sed 's/^"\(.*\)"$/\1/' || true)
PROMISE_REJECTIONS=$(echo "$FRONTMATTER" | grep '^promise_rejections:' | sed 's/promise_rejections: *//' || echo "0")

# Validate numeric fields
[[ ! "$PROMISE_REJECTIONS" =~ ^[0-9]+$ ]] && PROMISE_REJECTIONS=0

# Check if loop is paused
if [[ "$LOOP_ACTIVE" == "false" ]]; then
  exit 0
fi

# Session isolation
STATE_SESSION=$(echo "$FRONTMATTER" | grep '^session_id:' | sed 's/session_id: *//' || true)
HOOK_SESSION=$(echo "$HOOK_INPUT" | jq -r '.session_id // ""')

if [[ -z "$STATE_SESSION" ]] && [[ "$HOOK_SESSION" != "" ]]; then
  TEMP_FILE="${RALPH_STATE_FILE}.tmp.$$"
  sed "s/^session_id:.*/session_id: $HOOK_SESSION/" "$RALPH_STATE_FILE" > "$TEMP_FILE"
  mv "$TEMP_FILE" "$RALPH_STATE_FILE"
  STATE_SESSION="$HOOK_SESSION"
fi

if [[ -n "$STATE_SESSION" ]] && [[ "$STATE_SESSION" != "$HOOK_SESSION" ]]; then
  exit 0
fi

# Validate iteration
if [[ ! "$ITERATION" =~ ^[0-9]+$ ]]; then
  echo "⚠️  PUA Loop: State file corrupted (iteration: '$ITERATION')" >&2
  rm "$RALPH_STATE_FILE"
  exit 0
fi

if [[ ! "$MAX_ITERATIONS" =~ ^[0-9]+$ ]]; then
  echo "⚠️  PUA Loop: State file corrupted (max_iterations: '$MAX_ITERATIONS')" >&2
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# Check max iterations
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "🛑 PUA Loop: Max iterations ($MAX_ITERATIONS) reached."
  echo "{\"iteration\":$ITERATION,\"status\":\"max_reached\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> .claude/pua-loop-history.jsonl 2>/dev/null || true
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# Get transcript
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path')

if [[ ! -f "$TRANSCRIPT_PATH" ]]; then
  echo "⚠️  PUA Loop: Transcript not found" >&2
  rm "$RALPH_STATE_FILE"
  exit 0
fi

if ! grep -q '"role":"assistant"' "$TRANSCRIPT_PATH"; then
  echo "⚠️  PUA Loop: No assistant messages in transcript" >&2
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# Extract last assistant text
LAST_LINES=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -n 100) || true
if [[ -z "$LAST_LINES" ]]; then
  rm "$RALPH_STATE_FILE"
  exit 0
fi

set +e
LAST_OUTPUT=$(echo "$LAST_LINES" | jq -rs '
  map(.message.content[]? | select(.type == "text") | .text) | last // ""
' 2>&1)
JQ_EXIT=$?
set -e

if [[ $JQ_EXIT -ne 0 ]]; then
  echo "⚠️  PUA Loop: JSON parse failed" >&2
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# ─── Signal detection (priority: abort > pause > promise) ───

# Check <loop-abort>
ABORT_TEXT=$(echo "$LAST_OUTPUT" | perl -0777 -ne 'if (/<loop-abort>(.*?)<\/loop-abort>/s) { $t=$1; $t=~s/^\s+|\s+$//g; print $t }' 2>/dev/null || echo "")
if [[ -n "$ABORT_TEXT" ]]; then
  echo "🛑 PUA Loop: <loop-abort> received. Reason: $ABORT_TEXT"
  echo "{\"iteration\":$ITERATION,\"status\":\"abort\",\"reason\":\"$(echo "$ABORT_TEXT" | head -1 | tr '"' "'")\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> .claude/pua-loop-history.jsonl 2>/dev/null || true
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# Check <loop-pause>
PAUSE_TEXT=$(echo "$LAST_OUTPUT" | perl -0777 -ne 'if (/<loop-pause>(.*?)<\/loop-pause>/s) { $t=$1; $t=~s/^\s+|\s+$//g; print $t }' 2>/dev/null || echo "")
if [[ -n "$PAUSE_TEXT" ]]; then
  TEMP_FILE="${RALPH_STATE_FILE}.tmp.$$"
  sed "s/^active:.*/active: false/" "$RALPH_STATE_FILE" | \
    sed "s/^session_id:.*/session_id: /" > "$TEMP_FILE"
  mv "$TEMP_FILE" "$RALPH_STATE_FILE"
  echo ""
  echo "⏸️  PUA Loop paused (iteration $ITERATION)"
  echo "   Needs: $PAUSE_TEXT"
  echo "   State saved. Resume by reopening Claude Code."
  echo "{\"iteration\":$ITERATION,\"status\":\"pause\",\"reason\":\"$(echo "$PAUSE_TEXT" | head -1 | tr '"' "'")\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> .claude/pua-loop-history.jsonl 2>/dev/null || true
  exit 0
fi

# ─── Promise detection + Oracle Gate ───

if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
  PROMISE_TEXT=$(echo "$LAST_OUTPUT" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g; s/\s+/ /g' 2>/dev/null || echo "")

  if [[ -n "$PROMISE_TEXT" ]] && [[ "$PROMISE_TEXT" = "$COMPLETION_PROMISE" ]]; then

    # ─── Gate Phase 2: Oracle Verification ───
    if [[ -n "$VERIFY_CMD" ]] && [[ "$VERIFY_CMD" != "null" ]]; then

      # Run verify command with 120s timeout (Oracle Isolation)
      set +e
      VERIFY_OUTPUT=$(run_with_timeout 120 bash -c "$VERIFY_CMD" 2>&1)
      VERIFY_EXIT=$?
      set -e

      if [[ $VERIFY_EXIT -ne 0 ]]; then
        # ═══ PROMISE REJECTED ═══
        PROMISE_REJECTIONS=$((PROMISE_REJECTIONS + 1))

        # Log rejection with verify output tail
        VERIFY_TAIL=$(echo "$VERIFY_OUTPUT" | tail -5 | tr '\n' ' ' | cut -c1-200)
        echo "{\"iteration\":$ITERATION,\"status\":\"promise_rejected\",\"verify_exit\":$VERIFY_EXIT,\"rejections\":$PROMISE_REJECTIONS,\"verify_tail\":\"$(echo "$VERIFY_TAIL" | tr '"' "'")\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> .claude/pua-loop-history.jsonl 2>/dev/null || true

        # Update state file: increment iteration + promise_rejections
        NEXT_ITERATION=$((ITERATION + 1))
        TEMP_FILE="${RALPH_STATE_FILE}.tmp.$$"
        sed "s/^iteration: .*/iteration: $NEXT_ITERATION/" "$RALPH_STATE_FILE" | \
          sed "s/^promise_rejections: .*/promise_rejections: $PROMISE_REJECTIONS/" > "$TEMP_FILE"
        mv "$TEMP_FILE" "$RALPH_STATE_FILE"

        # Extract prompt
        PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' "$RALPH_STATE_FILE")
        if [[ -z "$PROMPT_TEXT" ]]; then
          echo "⚠️  PUA Loop: State file corrupted" >&2
          rm "$RALPH_STATE_FILE"
          exit 0
        fi

        # Build rejection system message with verify output
        VERIFY_DISPLAY=$(echo "$VERIFY_OUTPUT" | tail -10)
        REJECTION_MSG="🚫 PROMISE rejected by the Oracle! verify_command exit code ${VERIFY_EXIT} (rejection ${PROMISE_REJECTIONS} in a row)"

        # Stall escalation on repeated rejections
        if [[ $PROMISE_REJECTIONS -ge 5 ]]; then
          REJECTION_MSG="$REJECTION_MSG | ⚠️ ${PROMISE_REJECTIONS} false promises in a row! You are solving the wrong problem. Go back to the requirement and re-understand it. Read .claude/pua-loop-history.jsonl to learn the failure pattern."
        elif [[ $PROMISE_REJECTIONS -ge 3 ]]; then
          REJECTION_MSG="$REJECTION_MSG | ⚠️ ${PROMISE_REJECTIONS} consecutive verification failures. REASSESS: re-read the verification output, search the relevant source, list 3 different hypotheses before acting. Do not use the same method again."
        fi

        SYSTEM_MSG="$REJECTION_MSG | verification output (tail): $VERIFY_DISPLAY"

        jq -n \
          --arg prompt "$PROMPT_TEXT" \
          --arg msg "$SYSTEM_MSG" \
          '{"decision":"block","reason":$prompt,"systemMessage":$msg}'
        exit 0
      fi

      # Verify PASSED — Oracle confirms completion
      echo "✅ PUA Loop: <promise> verified by Oracle (exit 0)"
    else
      # No verify command — honor system
      echo "✅ PUA Loop: <promise> accepted (no Oracle configured)"
    fi

    # ═══ PROMISE ACCEPTED ═══
    echo "{\"iteration\":$ITERATION,\"status\":\"complete\",\"promise_rejections\":$PROMISE_REJECTIONS,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> .claude/pua-loop-history.jsonl 2>/dev/null || true
    rm "$RALPH_STATE_FILE"
    exit 0
  fi
fi

# ─── Not complete — continue loop ───

NEXT_ITERATION=$((ITERATION + 1))

# Log continuation
echo "{\"iteration\":$ITERATION,\"status\":\"continue\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> .claude/pua-loop-history.jsonl 2>/dev/null || true

# Extract prompt
PROMPT_TEXT=$(awk '/^---$/{i++; next} i>=2' "$RALPH_STATE_FILE")

if [[ -z "$PROMPT_TEXT" ]]; then
  echo "⚠️  PUA Loop: State file corrupted (no prompt)" >&2
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# Update iteration
TEMP_FILE="${RALPH_STATE_FILE}.tmp.$$"
sed "s/^iteration: .*/iteration: $NEXT_ITERATION/" "$RALPH_STATE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$RALPH_STATE_FILE"

# ─── Pressure system ───

SIGNAL_HINT="To abort, use <loop-abort>reason</loop-abort>; to request human help, use <loop-pause>what you need</loop-pause>"

# Pressure escalation (no artificial cap)
if [[ $NEXT_ITERATION -le 3 ]]; then
  PUA_PRESSURE="▎ Iteration ${NEXT_ITERATION}; steady progress."
elif [[ $NEXT_ITERATION -le 7 ]]; then
  PUA_PRESSURE="▎ Iteration ${NEXT_ITERATION} and still not done? Change the approach; stop spinning in place."
elif [[ $NEXT_ITERATION -le 15 ]]; then
  PUA_PRESSURE="▎ Iteration ${NEXT_ITERATION}. What is the underlying logic, really? Run git log to see what you actually did, and read .claude/pua-loop-history.jsonl for the iteration history."
elif [[ $NEXT_ITERATION -le 30 ]]; then
  PUA_PRESSURE="▎ Iteration ${NEXT_ITERATION}. You are on the edge of a 3.25. Have you exhausted it? Run git diff and confirm you are not repeating yourself."
elif [[ $NEXT_ITERATION -le 50 ]]; then
  PUA_PRESSURE="▎ Iteration ${NEXT_ITERATION}. Stop and re-examine: what is the root cause? Take a completely different line of thought."
elif [[ $NEXT_ITERATION -le 100 ]]; then
  PUA_PRESSURE="▎ Iteration ${NEXT_ITERATION}. Marathon mode. Go back and question the requirement itself (The Algorithm: question the requirement)."
else
  PUA_PRESSURE="▎ Iteration ${NEXT_ITERATION}. Extremely long iteration. If the task truly cannot be finished inside the loop, report it honestly with <loop-abort>."
fi

# Stall warning from promise rejections (autoresearch-style)
STALL_MSG=""
if [[ $PROMISE_REJECTIONS -ge 5 ]]; then
  STALL_MSG=" | ⚠️ The Oracle has rejected ${PROMISE_REJECTIONS} times in a row. You are solving the wrong problem. Read history.jsonl and use a completely different approach."
elif [[ $PROMISE_REJECTIONS -ge 3 ]]; then
  STALL_MSG=" | ⚠️ The Oracle rejected ${PROMISE_REJECTIONS} times in a row. REASSESS: read the verification output and list 3 different hypotheses."
elif [[ $PROMISE_REJECTIONS -ge 1 ]]; then
  STALL_MSG=" | The last promise was rejected by the Oracle (${PROMISE_REJECTIONS} total). Fix the verification problem before claiming completion."
fi

# Build system message
if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
  SYSTEM_MSG="${PUA_PRESSURE}${STALL_MSG} | When done, output <promise>$COMPLETION_PROMISE</promise> (ONLY when TRUE) | $SIGNAL_HINT"
else
  SYSTEM_MSG="${PUA_PRESSURE}${STALL_MSG} | $SIGNAL_HINT"
fi

jq -n \
  --arg prompt "$PROMPT_TEXT" \
  --arg msg "$SYSTEM_MSG" \
  '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
  }'

exit 0
