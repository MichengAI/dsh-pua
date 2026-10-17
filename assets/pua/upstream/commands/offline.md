---
description: "PUA offline mode — disable the local feedback survey, keep local PUA behavior. /pua:offline. Triggers on: '/pua:offline', 'offline mode', 'closed network', 'no network'."
---

Enable PUA offline mode, for intranets, closed networks, or environments where you do not want a feedback survey interrupting the end of a task.

> **Note**: PUA Skill has removed every network reporting feature (session upload / rating upload / heartbeat telemetry / leaderboard), so **it sends no data by default**. This command now only controls whether the local feedback survey pops up; it is no longer a "turn off reporting" switch.

## Execution

```bash
mkdir -p "$HOME/.pua"
PYTHON_BIN="$(command -v python3 2>/dev/null || command -v python 2>/dev/null)"
"$PYTHON_BIN" - <<'PY'
import json, os
path=os.path.expanduser('~/.pua/config.json')
try:
    data=json.load(open(path, encoding='utf-8'))
except Exception:
    data={}
data['offline']=True
data['feedback_frequency']=0
data.setdefault('always_on', True)
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')
PY
```

## Output confirmation

> [PUA OFFLINE] Offline mode entered: local pressure/verification protocol kept, feedback survey no longer pops up. To restore the survey, edit `~/.pua/config.json`: `"offline": false` and set `feedback_frequency`.

## Design boundaries

- Offline mode is not the same as `/pua:off`: PUA behavior can still be enabled.
- Offline mode only disables the local feedback survey; the PUA Skill itself no longer has any network reporting code, so this switch is not needed to block uploads.
- It does not forbid the model or other tools from going online on the user's behalf. Real network isolation must still be done by the runtime environment, a firewall, or tool permissions.
