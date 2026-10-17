# PUA Teardown Protocol — Agent Lifecycle Release Protocol

> **When a player on a professional team has already played his game, you have to take him off the field. Leaving him standing out there only drags down the whole team's rhythm.**
> — a corollary of the Netflix Keeper Test

The protocol before PUA v3 covered only the first 4 steps of the agent lifecycle (Define → Spawn → Monitor → Accept) and was missing the last 3 (**Release → Cleanup → Orphan handling**). This causes:

- A P8 that passed verification is never released → the context fills up with finished agents
- Nobody closes the tmux panes created by TeamCreate → resources stay resident
- A worktree-isolated agent leaves behind an orphan code copy when it finishes → wasted disk + context
- After session auto-compact, orphans double → OOM
- No separate SubagentStop accounting layer → can't answer "how many agents are still on the field"

**Clarification on "subagent hijacking the main loop"**: this was the original hypothesis, but checking the official Claude Code docs proved it **false** — the `Stop` event fires only for the main session, while a subagent's completion goes through the separate `SubagentStop` event. If hooks.json registers only `Stop`, the end of a subagent's lifecycle is invisible to the main session's hook. **The real disease is the missing accounting layer in the agent lifecycle**, not hook-layer hijacking. Starting with v3.1, a SubagentStop hook is registered as teardown accounting, which together with `/pua:team-status` provides the "current active lineup."

This document defines the 3 missing steps and provides executable commands/signals/checklists.

---

## Lifecycle: The 7 Phases Side by Side

| # | Phase | Standard protocol | Before PUA v3 | After PUA v3 |
|---|------|---------|----------|----------|
| 1 | Define | Task Prompt six elements | ✅ p9-protocol phase two | unchanged |
| 2 | Spawn | Agent/TeamCreate | ✅ agent-team.md | unchanged |
| 3 | Monitor | polling / SendMessage | ✅ p9-protocol phase three | unchanged |
| 4 | Accept | P8/P9 verification | ✅ p9-protocol phase four | unchanged |
| **5** | **Release** | explicit release signal | ❌ none | this doc §Release |
| **6** | **Cleanup** | clear worktree / pane | ❌ none | this doc §Cleanup |
| **7** | **Orphan handling** | orphan detection + reclamation | ❌ none | this doc §Orphan |

---

## §Release — 6 Release Rules

### R1. A passing P9 verification must emit a `[TEARDOWN]` signal

**WHY**: passing verification ≠ releasing the agent. By default P9 goes on assigning the next task to the same P8, but with no next task the old P8 just hangs there. `[TEARDOWN]` is the explicit "release/exit the field" instruction.

**HOW**: after the verification narration, P9 appends one line:

```
[TEARDOWN] p8-backend | reason: all_tasks_completed | release_resources: true
```

If there's another round of tasks:

```
[REASSIGN] p8-backend | next_task: <task_id> | keep_agent: true
```

The choice must be explicit; silent defaults are not allowed.

### R2. A P10 rotation forces teardown of the entire P9 team

**WHY**: when P9 switches (/pua:p9 → a different project), every P8 the old P9 managed becomes an orphan — no boss will ever come to verify their delivery.

**HOW**: when P10 issues a rotation order it must cascade:

```
[TEARDOWN-CASCADE] p9-current | descendants: [p8-backend, p8-frontend, p7-*] | reason: p9_rotation
```

### R3. A worktree agent auto-reclaims its worktree on completion

**WHY**: a git worktree created with `isolation: "worktree"` is not deleted automatically. 10 worktrees means 10 code copies — a double waste of disk and context.

**HOW**: after receiving `[P7-COMPLETION]`, P8/P9 runs:

```bash
# get the worktree path and branch from the Agent result
git worktree remove <worktree_path> --force
git branch -D <worktree_branch>  # if already merged
```

### R4. TeamCreate must be paired with TeamDelete

**WHY**: a tmux pane doesn't close automatically when the agent finishes. The team_name keeps occupying a session identifier.

**HOW**: after all P8s have sent `[P8-COMPLETION]`, P9 issues the wrap-up instruction:

```
TeamDelete({team_name: "<project-team>"})
```

If the team must be kept across sprints, declare it explicitly:

```
[TEAM-HIBERNATE] <team_name> | reason: next_sprint_continues | ttl: 24h
```

### R5. Default TTL for a background agent = 30min

**WHY**: an agent started with `run_in_background: true` isn't killed automatically. Forget to reclaim it = a permanent background process eating tokens.

**HOW**: record spawn_time into state at spawn; if it hasn't returned after 30min → the main thread proactively `TaskStop`s it:

```bash
# record agent_id and spawn_time in the state file
# inspection command (also usable as the /pua:reap-orphans backend)
jq '.agents[] | select(.spawn_time < (now - 1800)) | .id' ~/.claude/pua/active-agents.json
```

### R6. A subagent must not spawn another team (no nested orphans)

**WHY**: once a subagent creates its own team, the main session can't see those agents at all. The moment the subagent exits, that team is completely out of touch.

**HOW**: after P9 spawns it, a P8 may **only** spawn P7s with the `Agent tool` and **must not** use `TeamCreate`. Only P9 may create a team. Detection command:

```
hooks read HOOK_INPUT.parent_session_id; if non-empty and TeamCreate is attempted → deny
```

---

## §Cleanup — Proactive Cleanup Checklist

Run after every `[TEARDOWN]` fires:

```bash
# 1. clear worktree (if any)
git worktree list --porcelain | grep -A1 "<branch>" && git worktree remove ...

# 2. clear state file
rm -f "$HOME/.claude/pua/agent-<id>.state"

# 3. close tmux pane (if it's a TeamCreate member)
tmux kill-pane -t <pane_id>

# 4. record to teardown log
echo "{\"agent\":\"<id>\",\"reason\":\"<reason>\",\"ts\":\"$(date -u +%FT%TZ)\"}" >> "$HOME/.claude/pua/teardown.jsonl"
```

---

## §Orphan — Orphan Detection and Reclamation

**What counts as an orphan**:
- state file mtime > 30 minutes
- no matching active session
- no heartbeat update

**Three layers of defense**:

1. **Stop hook layer** (automatic): each time the main session Stops, scan `$HOME/.claude/pua/loop-*.md` and clean up anything stale (already implemented in `pua-loop-hook.sh`)
2. **SessionStart hook layer** (automatic): when a new session starts, scan the state directory and prompt the user to confirm stale entries
3. **Explicit user action** (manual): `/pua:reap-orphans` scans and reclaims in one shot

---

## §Switches — Switch Semantics Mapping

The lifecycle semantics of PUA's 14 slash commands under this protocol:

| Command | Original semantics | Extended semantics | Mapped operation |
|------|--------|-----------|---------|
| `/pua:on` | enable default loading | unchanged | config: always_on=true |
| `/pua:off` | disable default loading | **+ stop loop + cascade teardown** | off → cancel-loop → teardown-all |
| `/pua:cancel-pua-loop` | delete state file | **+ atomic cascade cleanup** | rm state + cleanup worktree + kill pane |
| `/pua:team-status` 🆕 | — | list active agents / PID / TTL | read state dir + jq summary |
| `/pua:reap-orphans` 🆕 | — | scan stale agents and TaskStop | batch reclaim for age > 30min |
| `/pua:teardown-all` 🆕 | — | cascade release P10→P9→P8→P7 | send TEARDOWN-CASCADE to every layer |

**Design principles**:
- **Idempotent**: running the same switch repeatedly has no side effects (re-rm is harmless, re-kill checks first)
- **Cascading**: a top-level switch triggers lower-level cleanup; the reverse is not allowed (a P7 cannot teardown a P8)
- **Observable**: every teardown writes to `$HOME/.claude/pua/teardown.jsonl`, which makes retrospectives easy

---

## §Autonomy — The Plugin Auto-Start Scenario

Because PUA loads automatically with `default=true`, you can't assume the user will clean up proactively. So the key is to give the hooks GC capability:

| Hook event | Autonomous behavior | Actual implementation |
|----------|---------|---------|
| `SessionStart` | scan stale loop state, prompt the user to confirm reclamation | ✅ `session-restore.sh` |
| `PreCompact` | dump the active agent list into HANDOFF | ✅ inline prompt hook |
| `Stop` (main session) | run loop logic + stale fallback cleanup | ✅ `pua-loop-hook.sh` + Gate 0 defense |
| `SubagentStop` | **agent completion accounting**: write teardown.jsonl + remove from active-agents.json | ✅ `subagent-teardown.sh` (new in v3.1) |
| `PostToolUse:Task` (planned) | record agent_id into active-agents.json at spawn | ⏳ to be implemented (needs Claude Code support for that event) |

**Important**: in Claude Code the Stop event fires **only** for the main session; a subagent's Stop event never reaches the Stop hook — so monitoring subagents requires a separate SubagentStop registration. Gate 0 in pua-loop-hook.sh is kept as a "defense layer" to catch future scheduling changes, but it is not a required line of defense.

---

## Verification

Acceptance criteria for this protocol landing:

- ✅ `TeardownDelete` appears in the skill docs at least half as often as `TeamCreate`
- ✅ `teardown` / `release` / `reclaim` appear ≥ 3 times after phase four of p9-protocol
- ✅ `pua-loop-hook.sh` has Gate 0 (subagent detection)
- ✅ `/pua:team-status`, `/pua:reap-orphans`, `/pua:teardown-all` exist
- ✅ `$HOME/.claude/pua/teardown.jsonl` is writable and has a schema
