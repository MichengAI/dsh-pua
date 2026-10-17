---
name: pua-loop
description: "PUA Loop — guided iterative development with recurring checks, completion evidence, and pause/abort markers. Use only when the user explicitly asks for loop/auto-iteration mode."
license: MIT
---

# PUA Loop — Auto-Iteration + Gate Protocol + PUA Quality Engine

> autoresearch proved it: 630 lines of Python + Oracle verification, 100 experiments in one overnight run, and every experiment's result is unforgeable.
> PUA Loop borrows the same gating design: **Claude saying "done" doesn't count; verify_command does.**

## Gate Protocol

Borrowing 5 design patterns from autoresearch:

### Pattern 1: Oracle Isolation

```
                    Claude outputs <promise>LOOP_DONE</promise>
                                 │
                                 ▼
                    ┌─── Stop Hook (Oracle) ───┐
                    │                          │
                    │  run verify_command      │
                    │  (Claude can't edit it)  │
                    │                          │
                    │  exit 0 ──→ ✅ accept    │
                    │  exit ≠0 ──→ 🚫 reject   │
                    │    → feed output back    │
                    │    → loop continues      │
                    └──────────────────────────┘
```

**verify_command is set by the user at launch, embedded in the state file frontmatter, and cannot be modified by Claude.** This is the implementation of the "the agent cannot modify the evaluation function" principle from autoresearch.

### Pattern 2: Two-Stage Gate

- **Phase 1 (in-prompt)**: Claude runs build/test itself and judges whether it's done
- **Phase 2 (in-hook)**: the Hook independently runs verify_command to confirm or reject

The two phases are separate. Even if Claude fools itself in Phase 1, the Phase 2 Oracle will stop it.

### Pattern 3: ASI (Failure Memory)

Each iteration's result is appended to `.claude/pua-loop-history.jsonl`:

```json
{"iteration":0,"status":"init","verify_command":"npm test","timestamp":"..."}
{"iteration":1,"status":"continue","timestamp":"..."}
{"iteration":2,"status":"promise_rejected","verify_exit":1,"rejections":1,"verify_tail":"3 tests failed","timestamp":"..."}
{"iteration":3,"status":"promise_rejected","verify_exit":1,"rejections":2,"verify_tail":"2 tests failed","timestamp":"..."}
{"iteration":4,"status":"complete","promise_rejections":2,"timestamp":"..."}
```

Git revert rolls back code, but history.jsonl is unaffected. Claude reads this file every round to avoid repeating failed approaches.

### Pattern 4: Stall Detection (forced reflection on consecutive losses)

| promise_rejections | Hook behavior |
|-------------------|-----------|
| 1-2 | Reminder: "the last promise was rejected by the Oracle" |
| 3-4 | REASSESS: "re-read the verification output, list 3 different hypotheses" |
| 5+ | Forced pivot: "you are solving the wrong problem. Go back to the requirement itself" |

### Pattern 5: Unbounded Iteration

Default `max_iterations: 0` (unbounded). There is no artificial ceiling. The loop never stops because it "ran too many rounds" — only these conditions terminate it:
1. `<promise>` passes Oracle verification
2. `<loop-abort>` manual termination signal
3. `max_iterations` reached (if the user set one)
4. user Ctrl+C

## Core Rules

1. **Load every behavioral protocol of the `pua:pua` core skill** — the three red lines, methodology, and pressure escalation run as usual
2. **Never call AskUserQuestion** — loop mode does not interrupt the user; all decisions are made autonomously
3. **Never say "I can't solve it"** — in the loop there is no right to exit; only after exhausting everything may you output the completion signal
4. **Every iteration**: read history.jsonl → git log → inspect the last change → execute → verify → repeat

## How to Start

When the user inputs `/pua:pua-loop "task description"`, run the following flow:

### Step 1: Start the PUA Loop

Run the setup script:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup-pua-loop.sh" "$ARGUMENTS" --completion-promise "LOOP_DONE"
```

**Important**: if the user provided a verifiable command (such as `npm test`, `cargo build`, `curl`), automatically append `--verify 'command'`. For example:

- User says "Fix all tests" → `--verify 'npm test'`
- User says "Build a REST API" → `--verify 'curl -sf http://localhost:3000/health'`
- User says "Optimize bundle size" → no clear verify, don't append

If a verification command can be inferred from the task description, proactively append `--verify`. If unsure, don't append (fall back to the honor system).

### Step 2: Tell the User

Output:
```
▎ [PUA Loop] Auto-iteration mode started. No ceiling; run until the Oracle verifies.
▎ Completion condition: <promise>LOOP_DONE</promise> (independently verified by the Oracle)
▎ To cancel: Ctrl+C / /cancel-pua-loop
▎ Simple because we trust — but the Oracle does not trust you.
```

### Step 3: Start Executing the Task

Execute per the behavioral protocol of the PUA core skill.

## Iteration Pressure Escalation

| Iteration round | Behavioral requirement |
|---------|---------|
| 1-3 | Steady progress, establish a baseline |
| 4-7 | Switch approaches, stop spinning in place |
| 8-15 | Review git log + history.jsonl, analyze the root cause |
| 16-30 | Have you exhausted everything? Confirm with git diff that you aren't repeating |
| 31-50 | Stop and re-examine the root cause, use a completely different approach |
| 51-100 | Go back and question the requirement itself again |
| 100+ | Honest assessment: if it truly is impossible, `<loop-abort>` |

## Completion Conditions

Before outputting `<promise>LOOP_DONE</promise>`, all of these must hold:
1. The task's core functionality is implemented
2. You first ran the verification command yourself and confirmed it passes (Phase 1)
3. You know the Oracle will independently run the verification again (Phase 2)
4. Similar problems have been scanned for

**If the Oracle rejects your promise:**
1. Read the verification output returned by the hook
2. Fix the cause of the verification failure
3. Run the verification yourself again to confirm it passes
4. Output `<promise>` again

## Human-Intervention Signals

### `<loop-abort>` — Terminate
Use when the task is impossible (needs external permissions, fundamental requirement change). Delete the state file; the loop terminates.

### `<loop-pause>` — Pause
Use when the user must fill in configuration. State is preserved and a new session auto-resumes.
Write progress to `.claude/pua-loop-context.md` before outputting.

### Forbidden
- Don't use `<loop-abort>` to dodge difficulty — only use it when something truly cannot be automated
- Don't abort just because the Oracle rejected you — fix the verification problem

## Relationship to autoresearch

| Dimension | karpathy/autoresearch | PUA Loop |
|------|----------------------|----------|
| Oracle | evaluate_bpb() physically isolated | verify_command in frontmatter, unmodifiable by Claude |
| Gate layers | 1 layer (metric only) | 2 layers (Claude self-verification + hook Oracle) |
| Failure memory | results.tsv | pua-loop-history.jsonl (ASI pattern) |
| Stall detection | none | promise_rejections counter + forced REASSESS |
| Rollback | git reset --hard | PUA methodology switch (no rollback, change direction) |
| Termination | NEVER STOP | NEVER STOP (except when the Oracle verifies) |
| Quality engine | none | PUA three red lines + pressure escalation |
