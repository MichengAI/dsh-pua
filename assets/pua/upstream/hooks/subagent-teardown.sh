#!/bin/bash
# PUA SubagentStop hook - the real teardown accounting layer
#
# Responsibility (single): when a subagent finishes, append one accounting record to teardown.jsonl
# Never blocks and never disturbs the main flow; pure append-only recording.
#
# Where the data goes:
#   $HOME/.claude/pua/teardown.jsonl   - aggregated by /pua:team-status
#   $HOME/.claude/pua/active-agents.json - removed from the in_progress set
#
# Input fields (from the Claude Code SubagentStop payload):
#   session_id, transcript_path, cwd, hook_event_name="SubagentStop"
#   agent_id, agent_type, agent_transcript_path (SubagentStop only)

set -uo pipefail

command -v jq &>/dev/null || exit 0

HOOK_INPUT=$(cat)
PUA_DIR="${HOME}/.claude/pua"
mkdir -p "$PUA_DIR" 2>/dev/null || exit 0

# Extract the key fields (all fail-safe empty strings)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // ""' 2>/dev/null || echo "")
AGENT_TYPE=$(echo "$HOOK_INPUT" | jq -r '.agent_type // ""' 2>/dev/null || echo "")
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
LAST_MSG=$(echo "$HOOK_INPUT" | jq -r '.last_assistant_message // ""' 2>/dev/null | head -c 200 | tr '\n' ' ' || echo "")

TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Append teardown record (jsonl = one line per record, -c compact)
jq -cn \
  --arg agent_id "$AGENT_ID" \
  --arg agent_type "$AGENT_TYPE" \
  --arg parent_session "$SESSION_ID" \
  --arg last_msg "$LAST_MSG" \
  --arg ts "$TS" \
  '{
    event: "subagent_stop",
    agent_id: $agent_id,
    agent_type: $agent_type,
    parent_session: $parent_session,
    last_msg_preview: $last_msg,
    ts: $ts
  }' >> "$PUA_DIR/teardown.jsonl" 2>/dev/null || true

# If active-agents.json exists, try to remove agent_id from it (best-effort)
ACTIVE_FILE="$PUA_DIR/active-agents.json"
if [[ -f "$ACTIVE_FILE" ]] && [[ -n "$AGENT_ID" ]]; then
  TMP="$ACTIVE_FILE.tmp.$$"
  jq --arg aid "$AGENT_ID" '.agents |= map(select(.id != $aid))' "$ACTIVE_FILE" > "$TMP" 2>/dev/null \
    && mv "$TMP" "$ACTIVE_FILE" \
    || rm -f "$TMP" 2>/dev/null
fi

exit 0
