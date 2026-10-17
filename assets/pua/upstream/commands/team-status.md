---
description: "View the current active PUA agent/team list, PID, TTL. /pua:team-status. Triggers on: '/pua:team-status', 'view agent status', 'pua team status', 'list agents'."
allowed-tools: ["Bash(ls:*)", "Bash(stat:*)", "Bash(jq:*)", "Bash(cat:*)", "Bash(test:*)", "Bash(find:*)"]
---

# PUA Team Status — active agent list

A professional team needs a lineup sheet. This command lists every agent still "on the field" and its age.

## Steps

1. Make sure `~/.claude/pua/` exists:
   ```bash
   mkdir -p "$HOME/.claude/pua"
   ```

2. Scan loop state files:
   ```bash
   ls -la "$HOME/.claude/pua/"loop-*.md 2>/dev/null || echo "NO_LOOP"
   ```

3. Scan the legacy relative path (backward compatible):
   ```bash
   test -f .claude/pua-loop.local.md && ls -la .claude/pua-loop.local.md || echo "NO_LEGACY"
   ```

4. Scan the active agents records (if a PostToolUse hook has recorded them):
   ```bash
   test -f "$HOME/.claude/pua/active-agents.json" && \
     jq -r '.agents[] | "\(.id) | spawn=\(.spawn_time) | status=\(.status)"' \
       "$HOME/.claude/pua/active-agents.json" || echo "NO_AGENTS_FILE"
   ```

5. Output in table format:

   ```
   | Type    | ID / File                          | Age      | Status    |
   |---------|-----------------------------------|----------|-----------|
   | loop    | loop-<session>.md                 | 00:05:23 | ACTIVE    |
   | loop    | .claude/pua-loop.local.md         | 01:34:11 | ⚠️ STALE  |
   | agent   | p8-backend                        | 00:12:04 | RUNNING   |
   | orphan  | loop-<dead>.md                    | 02:15:00 | 🧟 ORPHAN |
   ```

6. If STALE/ORPHAN is found, append a hint:
   > 🧹 Found N orphan states. Suggest running `/pua:reap-orphans` to clean them in bulk.

## Decision rules

- **ACTIVE**: mtime < 30min
- **STALE**: 30min ≤ mtime < 2h
- **ORPHAN**: mtime ≥ 2h or no matching active session

## When there is no active team

> [PUA TEAM STATUS] No active agents. The team is off work.
