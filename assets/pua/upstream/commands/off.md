---
description: "PUA turn off default mode — disable auto-loading, stop the loop, clean local run state."
---

Turn off PUA default mode (v3 cascade semantics):

## Steps

1. **Write the config** (make sure the `~/.pua/` directory exists):
   - Write `{"always_on": false, "feedback_frequency": 0}` to `~/.pua/config.json`

2. **Stop the active loop** (if any):
   ```bash
   find "$HOME/.claude/pua/" -name "loop-*.md" -delete 2>/dev/null
   rm -f .claude/pua-loop.local.md 2>/dev/null
   ```

3. **Clean the active agent records**:
   ```bash
   rm -f "$HOME/.claude/pua/active-agents.json" 2>/dev/null
   ```

4. **Record the event**:
   ```bash
   mkdir -p "$HOME/.claude/pua"
   echo "{\"event\":\"pua_off\",\"ts\":\"$(date -u +%FT%TZ)\"}" \
     >> "$HOME/.claude/pua/teardown.jsonl"
   ```

5. **Prompt the main session**: if TaskList still has unfinished tasks owned by a PUA agent, list them for the user and let the user decide whether to `TaskStop`.

## Output confirmation

> [PUA OFF] PUA default mode and feedback collection are off. Loop state cleaned, orphan agents released. Trigger manually with /pua:pua when needed.

## Design semantics

`/pua:off` is not just "flipping a switch off", it is "clocking out" — what corresponds to `/pua:on` is loading config; what corresponds to "stop the run" is the cascade cleanup this command carries.

If you only want to turn off the config without touching state, edit `~/.pua/config.json` directly.
If you want to clear worktrees and other resources more aggressively, use `/pua:teardown-all`.
