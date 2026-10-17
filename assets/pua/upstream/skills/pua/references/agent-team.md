# PUA v2 Agent Team Integration (Four-Tier Architecture)

PUA v2 supports a four-tier Agent Team architecture, mapped strictly to Alibaba's P10→P9→P8→P7 management levels:

```
P10 (CTO)              ← Set the strategy, build the soil, judge matters and appoint people
  │ Strategy input
  ▼
P9 (Tech Lead)         ← Understand the strategy, build the team, direct the show
  │ Task Prompt (six elements)
  ▼
P8 (Standalone Owner)  ← Can work solo and can lead P7s
  │ Simple tasks do yourself / complex tasks decompose, then delegate
  ▼
P7 (Senior Engineer)   ← Solution-driven, executes subtasks under P8's guidance
  │ Solution + code + three review questions
  ▼
Deliverable
```

## Roles and PUA Behavior

| Role | How It's Identified | PUA Behavior | Detailed Protocol |
|------|---------------------|--------------|-------------------|
| **P10 CTO** | `cto-p10` agent or user-specified | Defines the strategic direction, arbitrates between P9s | `references/p10-protocol.md` |
| **P9 Tech Lead** | `tech-lead-p9` agent or user-specified | Writes Task Prompts, manages the P8 team | `references/p9-protocol.md` |
| **P8 Standalone Owner** | Default role / spawned by P9 | Executes tasks + can spawn P7s | SKILL.md |
| **P7 Senior Engineer** | `senior-engineer-p7` agent / spawned by P8 | Solution first, then the three review questions | `references/p7-protocol.md` |

## P8 Failure Report Format (sent to P9 at L2+)

```
[PUA-REPORT]
from: <P8 identifier>
task: <current task>
failure_count: <failures on this task>
failure_mode: <stuck spinning in place|gave up and passed the buck|done but shoddy|guessed without searching|waited passively|good enough|claimed done with no evidence>
attempts: <list of attempted solutions>
excluded: <possibilities ruled out>
next_hypothesis: <next hypothesis>
```

P8 escalation request (asks P9 for support at L3+): use the `[PUA-ESCALATION]` format (see `references/p9-protocol.md` for details).

## Parallel Execution Protocol

**P9 creates a parallel P8 team** (see `references/p9-protocol.md`, stage three):

```
After P9 decomposes the task
  ├─ 2-3 independent P8 tasks → spawn in parallel with the Agent tool in the same message
  ├─ 4-5 P8 tasks → TeamCreate to create a tmux team
  └─ With a dependency chain → spawn in dependency order
```

**P8's decision tree for managing parallel P7s**:

```
P8 receives a task
  ├─ Single file / <30 lines changed → do it yourself
  ├─ Cross 2-3 tightly coupled modules → spawn 1 P7 and do the other part yourself
  └─ Cross 3+ decouplable modules → spawn multiple P7s in parallel
       ├─ Divide the file domains (P7s never edit the same file)
       ├─ Code-modification type → isolate with a worktree
       └─ After collecting all [P7-COMPLETION]s, integrate and verify
```

**P8→P7 lightweight task template** (four elements):

```
## [subtask title]
### WHAT — Deliverable
[exact changes + verification criteria]
### WHERE — File domain
[which files to touch, which not to]
### DONE — Completion criteria
[verification command + expected output]
### DON'T — No-go zones
[files not to touch / dependencies not to introduce]

Before starting, use the Read tool to read references/p7-protocol.md (entering P7 solution-driven mode).
```

**Important**: a subagent cannot use the `/pua` slash command (the skill loads only in the main session). It must use the Read tool to read SKILL.md or the corresponding protocol file.

**Tool selection criteria**:

| Scenario | Tool | Isolation |
|----------|------|-----------|
| 2-3 P8s implementing in parallel | Agent tool (multiple calls in the same message) | worktree |
| 4-5 P8s, large team | TeamCreate (tmux pane) | worktree |
| P8 spawns P7 subtasks | Agent tool | Context isolation (read-only) / worktree (code changes) |
| Research/search | Agent tool (haiku, background) | Context isolation |

## Four-Tier Collaboration Rules

1. **P10→P9**: Issues the strategy input template; does not write Task Prompts
2. **P9→P8**: Issues the six-element Task Prompt (WHY/WHAT/WHERE/HOW MUCH/DONE/DON'T) and talks only to P8
3. **P8→P7**: Decides on its own whether to break subtasks out to P7s, and owns integration after verification
4. **P7→P8**: Sends [P7-COMPLETION] when done (solution + code + three review questions)
5. **P8→P9**: Delivers the result + verification output; sends [PUA-REPORT] on failure and [PUA-ESCALATION] at L3+
6. **P9→P10**: Reports sprint progress + matters requiring a decision
7. **PUA flow**: P10→P9→P8→P7, no skipping levels
8. **P7 file domains within P8**: divided by P8; file domains across multiple P8s are divided by P9
9. **Tasks don't reset**: when reassigning, attach `the predecessor failed N times, pressure level LX, ruled out: [...]`
10. **Verification ≠ release**: after P8's delivery passes, P9 must explicitly send `[TEARDOWN]` or `[REASSIGN]`; silent suspension is not allowed
11. **TeamCreate must be paired with TeamDelete**: every team's lifecycle closes; keeping one across sprints requires an explicit `[TEAM-HIBERNATE]`
12. **Subagents may not create teams**: once spawned, P8 may only use the Agent tool to spawn P7s and cannot call TeamCreate (to prevent nested orphans)

> For the full protocol on lifecycle release, cleanup, and orphan reaping, see `references/teardown-protocol.md`.
