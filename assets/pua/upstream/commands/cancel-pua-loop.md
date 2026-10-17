---
description: "Cancel the currently active PUA Loop (atomic cascade: state + worktree + record). /pua:cancel-pua-loop. Triggers on: '/pua:cancel-pua-loop', 'cancel pua loop', 'stop pua loop', 'kill the loop'."
allowed-tools: ["Bash(test:*)", "Bash(rm:*)", "Bash(ls:*)", "Bash(find:*)", "Bash(date:*)", "Bash(mkdir:*)", "Bash(grep:*)", "Bash(cat:*)"]
---

# Cancel PUA Loop — atomic cascade cancel

v3 semantics: not just deleting state, but also cleaning the related resources and recording a teardown event. Guaranteed idempotent.

## Steps

1. **Scan every possible loop state**:
   ```bash
   mkdir -p "$HOME/.claude/pua"
   LOOP_FILES=$(find "$HOME/.claude/pua/" -name "loop-*.md" 2>/dev/null)
   LEGACY_FILE=""
   test -f .claude/pua-loop.local.md && LEGACY_FILE=".claude/pua-loop.local.md"
   ```

2. **If all of them are empty**:
   > No active PUA loop found.

3. **If any exist**:
   - For each file, read the iteration (grep `^iteration:`)
   - Delete the files:
     ```bash
     find "$HOME/.claude/pua/" -name "loop-*.md" -delete 2>/dev/null
     rm -f .claude/pua-loop.local.md 2>/dev/null
     ```
   - Clear the active-agents record:
     ```bash
     rm -f "$HOME/.claude/pua/active-agents.json" 2>/dev/null
     ```
   - Record the cancel event:
     ```bash
     echo "{\"event\":\"loop_cancelled\",\"iteration_at_cancel\":<N>,\"ts\":\"$(date -u +%FT%TZ)\"}" \
       >> "$HOME/.claude/pua/teardown.jsonl"
     ```

4. **Output report**:

   ```
   > [PUA CANCEL] Loop cancelled:
   >   - loop-<session>.md (was at iteration N)
   >   - active-agents.json cleared
   > Written to ~/.claude/pua/teardown.jsonl
   ```

## Design principles

- **Atomicity**: all cleared or nothing touched; "state deleted but active-agents missed" is not allowed
- **Idempotency**: repeated runs have no side effects (rm -f / find -delete do not error on non-existent paths)
- **Observability**: every cancel event lands in teardown.jsonl, convenient for retrospectives

## Compared with other commands

| Command | Stop loop | Clear worktree | Clear config | Scenario |
|------|---------|------------|----------|------|
| `/pua:cancel-pua-loop` | ✅ | ❌ | ❌ | Single brake |
| `/pua:off` | ✅ | ❌ | ✅ | Off work |
| `/pua:teardown-all` | ✅ | ✅ | ❌ | Full wrap-up |
| `/pua:reap-orphans` | stale only | ❌ | ❌ | Periodic housekeeping |
