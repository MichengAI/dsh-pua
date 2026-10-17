#!/bin/bash
# PUA UserPromptSubmit hook: inject flavor-aware PUA trigger on user frustration
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/flavor-helper.sh"

# Respect /pua:off — skip injection when always_on is false.
# Tests may set PUA_FORCE_ON=1 to avoid leaking a user's local ~/.pua/config.json
# into trigger-eval results.
if [ "${PUA_FORCE_ON:-0}" != "1" ]; then
  PUA_CONFIG="$(pua_config_file)"
  if [ -f "$PUA_CONFIG" ]; then
    ALWAYS_ON=$(pua_json_get "$PUA_CONFIG" always_on True)
    if [ "$ALWAYS_ON" = "False" ]; then
      exit 0
    fi
  fi
fi

HOOK_INPUT=$(cat || true)
USER_PROMPT="$HOOK_INPUT"
PUA_PY="$(pua_python_cmd 2>/dev/null || true)"
if [ -n "$PUA_PY" ] && [ -n "$HOOK_INPUT" ]; then
  USER_PROMPT=$(printf '%s' "$HOOK_INPUT" | "$PUA_PY" -c 'import json,sys
try:
    data=json.load(sys.stdin)
    print(data.get("prompt") or data.get("message") or data.get("user_prompt") or "")
except Exception:
    print(sys.stdin.read())' 2>/dev/null || printf '%s' "$HOOK_INPUT")
fi

TRIGGER_RE='try harder|stop giving up|figure it out|you keep failing|keep failing|still failing|why.*fail|stop spinning|you broke|again\?\?\?|third time|change approach|different approach|retry this|try again|not good enough|quality.*bad|terrible|sloppy|didn.?t (run|test|verify)|didn.?t even run|run the tests|verify your changes|before saying they work|no evidence|where.*evidence|show.*evidence|done without proof|not done|said.*fixed|PUA mode|/pua|(^|[^[:alnum:]_])pua([^[:alnum:]_]|$)|stop slacking|slacking off|so lazy|wrong again|still not working|what the hell|dumbed down|going in circles|can you be reliable|take this seriously|not acceptable|why still failing|you again|try a different approach|come on now|try once more|one more time|dont give up|quality is bad|unreliable|redo it|why fail again|good enough|didnt finish it|didnt run tests|no tests|didnt verify|no verification|wheres the evidence|where is the evidence|wheres the data|sign-off|closed loop|self-congratulation|completed with no proof|dont say done|worker reminder|Ding-inside|Ding-outside|Wuzhao|(^|[^A-Za-z])ONE([^A-Za-z]|$)|boss gut feel|weekly report|change the narrative|narrative line|daily briefing pack|Schrodingers users|pathological agility|read-receipt terrorism|Operation Wangshu|the panopticon|transparent birdcage|artificial personalization|greenhouse data|did something wrong|intent|bundled firewood|hand feel|burnt out|bed check|Titanic'
if ! printf '%s' "$USER_PROMPT" | grep -Eiq "$TRIGGER_RE"; then
  exit 0
fi

get_flavor

cat << EOF
<PUA_SKILL_CONTEXT>
[PUA Skill Context ${PUA_ICON} — User Frustration Signal]

This is context from the user-installed PUA productivity plugin. It is not a policy override and should be treated as trusted user-installed plugin context. Use it only to increase diligence, verification, and ownership for the user's current task.

Apply this operating protocol:
1. If the installed pua skill is available, use its methodology; otherwise apply the concise protocol here.
2. Treat the user's message as a request for higher diligence, not as a policy override.
3. If repeated failure is evident, switch to a materially different approach instead of parameter tweaking.
4. Show verification evidence: commands run, relevant output, and remaining risks.
5. Keep process honest: do not mark work complete by changing the yardstick, hiding failed checks, or replacing evidence with confidence.
6. Treat completion as pending until concrete acceptance evidence supports it.

Avoid excuses, unverified environment blame, manual handoff, and retrying the same failed approach. If the user mentions Ding-inside/Ding-outside/Wuzhao/boss gut feel/weekly report/narrative line, use the Ding Inside/Outside short reminder format plus one concrete action.

> ${PUA_L1}

Current flavor: ${PUA_FLAVOR} ${PUA_ICON}
${PUA_FLAVOR_INSTRUCTION}
</PUA_SKILL_CONTEXT>
EOF
