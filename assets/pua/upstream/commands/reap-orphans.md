---
description: "Scan and clean expired local PUA agent/state."
allowed-tools: ["Bash(find:*)", "Bash(stat:*)", "Bash(rm:*)", "Bash(ls:*)", "Bash(date:*)", "Bash(mkdir:*)"]
---

# PUA Reap Orphans — orphan reaping

The engineering version of the Keeper Test: exit as soon as the job is done; anything that lingers and will not leave gets cleaned up.

## Steps

1. Make sure the directory exists:
   ```bash
   mkdir -p "$HOME/.claude/pua"
   ```

2. Scan loop states not updated for 30 minutes (the orphan cutoff line):
   ```bash
   find "$HOME/.claude/pua/" -name "loop-*.md" -type f -mmin +30 2>/dev/null
   ```

3. Also scan the legacy relative path:
   ```bash
   find .claude/ -maxdepth 1 -name "pua-loop.local.md" -type f -mmin +30 2>/dev/null
   ```

4. For each matching file:
   - read session_id and iteration (if parseable)
   - record to `$HOME/.claude/pua/teardown.jsonl`:
     ```bash
     echo "{\"reaped\":\"<file>\",\"age_min\":<N>,\"ts\":\"$(date -u +%FT%TZ)\",\"reason\":\"orphan_reap\"}" \
       >> "$HOME/.claude/pua/teardown.jsonl"
     ```
   - delete the state file:
     ```bash
     rm -f "<file>"
     ```

5. If `active-agents.json` exists, clean records with spawn_time > 30min (needs jq):
   ```bash
   test -f "$HOME/.claude/pua/active-agents.json" && \
     jq '.agents |= map(select(.spawn_time > (now - 1800)))' \
       "$HOME/.claude/pua/active-agents.json" > "$HOME/.claude/pua/active-agents.json.tmp" && \
     mv "$HOME/.claude/pua/active-agents.json.tmp" "$HOME/.claude/pua/active-agents.json"
   ```

6. Output the result:

   ```
   > [PUA REAP] Cleaned N orphan states:
   >   - loop-abc123.md (age 1h42m)
   >   - .claude/pua-loop.local.md (age 3h05m)
   > All written to ~/.claude/pua/teardown.jsonl for the record.
   ```

7. If there are no orphans:

   > [PUA REAP] No orphans found. Team discipline is good.

## Idempotency

- Repeating it is harmless: `rm -f` does not error on missing files
- teardown.jsonl is appended to, never overwritten, keeping the full history

## Safety guards

- Only cleans `$HOME/.claude/pua/` and `.claude/pua-loop.local.md`, never overreaches
- The age threshold is hardcoded at 30min and accepts no user argument (to avoid killing an active loop by mistake)
