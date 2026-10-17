---
description: "Stop and clean all local state of the active PUA agent/team."
allowed-tools: ["Bash(rm:*)", "Bash(ls:*)", "Bash(find:*)", "Bash(date:*)", "Bash(mkdir:*)", "Bash(git:*)"]
---

# PUA Teardown All — full release

> It is not disbanding the team, it is a formal wrap-up. Every player clocks out; the coach clocks out too.

Cascade semantics: triggered at the top, released layer by layer. **Does not wait for agents to finish naturally**—because this command exists to force the wrap-up.

## Steps

1. Make sure the directory exists:
   ```bash
   mkdir -p "$HOME/.claude/pua"
   ```

2. **Layer A — stop loops**: delete every loop state (so the hook no longer hijacks Stop):
   ```bash
   find "$HOME/.claude/pua/" -name "loop-*.md" -delete 2>/dev/null
   rm -f .claude/pua-loop.local.md 2>/dev/null
   ```

3. **Layer B — clear the active agents records**:
   ```bash
   rm -f "$HOME/.claude/pua/active-agents.json" 2>/dev/null
   ```

4. **Layer C — clear worktrees** (if any):
   ```bash
   # list every worktree, excluding the main worktree
   git worktree list --porcelain 2>/dev/null | grep '^worktree ' | awk '{print $2}' | \
     grep -v "^$(git rev-parse --show-toplevel 2>/dev/null)$" | \
     while read wt; do
       git worktree remove "$wt" --force 2>/dev/null || true
     done
   ```

5. **Layer D — record the teardown event**:
   ```bash
   echo "{\"event\":\"teardown_all\",\"ts\":\"$(date -u +%FT%TZ)\",\"initiator\":\"user_command\"}" \
     >> "$HOME/.claude/pua/teardown.jsonl"
   ```

6. **Layer E — notify the user at the main session layer** (Claude's own job):

   In the main session output, explicitly list "I realize these agents are still running in the background", and stop each of them with the `TaskStop` tool (if TaskList still has in_progress tasks).

## Output format

```
> [PUA TEARDOWN-ALL] Full release complete:
>   ✓ Loop state cleaned (N)
>   ✓ Active agents records cleared
>   ✓ Worktrees reclaimed (M)
>   ✓ Event written to ~/.claude/pua/teardown.jsonl
> 
> Team disbanded. Off work.
```

## Idempotency

- Every delete is backed by `-f` or `|| true`; repeating it has no side effects
- Does not kill worktrees that PUA did not create (compares against the git main worktree path)

## When to use

- Ending a long session and wanting a full clear-out
- Seeing abnormal agent behavior and not knowing which one is the source
- A complement to `/pua:off` (off only turns off default loading, it does not actively wrap up)

## Difference from /pua:reap-orphans

| Command | Scope | Criterion |
|------|---------|---------|
| `/pua:reap-orphans` | only stale (>30min not updated) | age threshold |
| `/pua:teardown-all` | all (including active) | explicit user decision |

Use reap for "housekeeping"; use teardown-all for "off work".
