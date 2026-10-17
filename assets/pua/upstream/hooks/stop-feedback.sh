#!/bin/bash
# Non-blocking, LOCAL-ONLY feedback reminder. A Stop stdout instruction does not
# reach the model. Use the documented user-visible systemMessage instead;
# /pua:survey quick uses AskUserQuestion and writes ~/.pua/feedback.jsonl only
# after the user chooses to record a rating. This hook never records a rating,
# reads hidden reasoning, uploads data, or blocks completion for a questionnaire.
set -euo pipefail
HOOK_INPUT="$(cat)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/flavor-helper.sh"
command -v jq >/dev/null 2>&1 || exit 0

# A malformed event, subagent, or recursive Stop never starts a feedback flow.
if ! printf '%s' "$HOOK_INPUT" | jq -e 'type == "object" and
  (.hook_event_name == "Stop") and (.stop_hook_active != true) and
  ((.parent_session_id // "") == "")' >/dev/null 2>&1; then exit 0; fi
CONFIG="$(pua_config_file)"
if [ -f "$CONFIG" ]; then
  [ "$(pua_json_get "$CONFIG" offline False)" != "True" ] || exit 0
  [ "$(pua_json_get "$CONFIG" always_on True)" != "False" ] || exit 0
fi
FREQUENCY=5
if [ -f "$CONFIG" ]; then
  freq="$(pua_json_get "$CONFIG" feedback_frequency 5)"
  case "$freq" in
    0|never|off) exit 0 ;;
    1|every) FREQUENCY=1 ;;
    *) [[ "$freq" =~ ^[1-9][0-9]{0,3}$ ]] && FREQUENCY="$freq" ;;
  esac
fi
TRANSCRIPT_PATH="$(printf '%s' "$HOOK_INPUT" | jq -r '.transcript_path // empty')"
[ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ] || exit 0
# Only assistant-visible narration can warrant a reminder. Skill source inside
# user tool_result blocks, input prompts, and hidden thinking are not behavior.
if ! jq -se 'any(.[]; ((.type // .role) == "assistant") and
  any(.message.content[]?; .type == "text" and
    ((.text // "") | test("PUA ACTIVE|\\[Auto-select:|\\[PIP-REPORT\\]|\\[PUA-REPORT\\]|\\[PUA-DIAGNOSIS\\]"))))' \
  "$TRANSCRIPT_PATH" >/dev/null 2>&1; then exit 0; fi

[ -n "${HOME:-}" ] || exit 0
umask 077
mkdir -p "$HOME/.pua"
COUNTER="$HOME/.pua/.stop_counter"
count=0
[ ! -f "$COUNTER" ] || count="$(cat "$COUNTER" 2>/dev/null || printf 0)"
[[ "$count" =~ ^[0-9]{1,8}$ ]] || count=0
count=$((10#$count + 1))
printf '%s\n' "$count" > "$COUNTER"
[ $((count % FREQUENCY)) -eq 0 ] || exit 0
jq -n --arg message 'PUA local feedback (optional): to record how this run went, run /pua:survey quick. Ratings are written only to the local ~/.pua/feedback.jsonl; skipping records nothing, blocks no delivery, and uploads nothing.' \
  '{systemMessage:$message}'
