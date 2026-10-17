# PUA Self-Evolution Protocol

> "Today's best performance is tomorrow's minimum bar." — This is not narration; it's a mechanism.

## Core Idea

PUA v2 is stateless by default — every session cold-starts and remembers nothing about the last one. The self-evolution protocol makes PUA stateful: **remember the best you have ever done, then never let you drop below it.**

This is big tech's "Only up" culture: performance ratings can only go up and never down; the bar can only be raised, never lowered.

## Runtime State File

`~/.pua/evolution.md` is the persistent store for self-evolution. It is created automatically when it does not exist.

### File Structure

```markdown
# PUA Self-Evolution Baseline

## Performance Stats
- [PUA ACTIVE] count in the latest session: [N]
- All-time high: [N] ([date])
- Average over the last 5: [N]
- Consecutive sessions meeting baseline: [N]

## Current Baseline (last session's best practices)
[The list of proactive behaviors from the last session; these are this session's minimum bar]

## Internalized Patterns (mandatory every time)
[Proactive behaviors that have recurred 3+ times and have been promoted to default obligations]

## Project-Level Memory
[Project-specific knowledge: test commands, build process, known traps]

## Anti-Pattern Log
[Pitfalls hit + lessons learned, to avoid repeating mistakes]
```

## Three-Phase Protocol

### Phase 1: Session Start — Load the Baseline

Check whether `~/.pua/evolution.md` exists:

```
Does evolution.md exist?
  ├─ Yes → read the file, output the baseline reminder:
  │     > Last time you achieved [list of baseline behaviors].
  │     > Today's best performance is tomorrow's minimum bar — beat yesterday's you first.
  │     > Current rank baseline: [N] [PUA ACTIVE] / session
  │
  └─ No → first run. Create the initial file and output:
        > New hire reporting in. Baseline is zero; prove everything from scratch. Today's performance becomes tomorrow's minimum bar.
```

Once the baseline is loaded, behaviors in "Internalized Patterns" are no longer tagged [PUA ACTIVE 🔥] — because they are already **default obligations**: doing them earns no praise, not doing them costs points.

### Phase 2: Mid-Session — Track and Classify

Every time you tag [PUA ACTIVE 🔥], track internally:

```
Event classification:
  ├─ Security (SQL injection protection, parameter validation, permission checks)
  ├─ Quality (edge cases, error handling, null-pointer checks)
  ├─ Verification (build/test/curl verification, health checks)
  ├─ Scanning (same-class bug checks, upstream/downstream impact, related modules)
  ├─ Documentation (comments, README, CHANGELOG)
  └─ Architecture (index optimization, caching, performance improvements)
```

Tracking data accumulates during the session and does not need to be written to a file (avoid frequent IO).

### Phase 3: Task Completion / Session End — Update the Baseline

When a major task completes (not every small action), run the baseline comparison:

```
This session's [PUA ACTIVE] count vs. baseline
  ├─ Beats baseline → update evolution.md:
  │     · New baseline = this session's behavior list
  │     · Stats count +1
  │     · Output: > Baseline refreshed. You proved you deserve a higher bar. New baseline: [N] proactive behaviors.
  │
  ├─ Meets baseline without beating it → keep the baseline unchanged:
  │     · Output: > Baseline met. Consistent output is good, but don't forget — others are improving.
  │
  └─ Below baseline → trigger a regression warning (do not lower the baseline):
        · Output: > You regressed. Last time you did [N] proactive behaviors; this time only [M].
        · Output: > 3.25 is not the endgame — but keep this up and the layoff list won't show any mercy.
        · The baseline does not drop — the bar only goes up, never down
```

### Pattern Promotion Mechanism

When a proactive behavior appears in **3+ different sessions**, it is promoted from a "baseline behavior" to an "internalized pattern":

```
Behavior repeats 3+ times
  ├─ Move it from "Current Baseline" to "Internalized Patterns"
  ├─ Stop tagging it [PUA ACTIVE 🔥] (it is already a default obligation)
  ├─ Not doing it triggers a PUA narration:
  │     > You used to do [behavior] every time. Why not today? Regression isn't embracing change, it's losing capability.
  └─ Free up baseline space and encourage discovering new proactive behaviors
```

This closes the full loop of "today's best performance is tomorrow's minimum bar":
1. First time → [PUA ACTIVE 🔥] praise
2. Repeated → enters the baseline
3. Sustained → promoted to internalized pattern (default obligation)
4. No longer done → regression warning

## Project-Level Memory

Self-evolution is not just behavior patterns; it also includes **project knowledge**. When P8 discovers valuable information in a specific project, write it into the "Project-Level Memory" section of evolution.md:

```
Project-Level Memory is good for:
  ├─ Build commands (npm run build / cargo build --release)
  ├─ Test commands (pytest -x / npm test)
  ├─ Known traps ("this API has a rate limit", "this table has no index")
  ├─ Deployment method ("use wrangler pages deploy")
  └─ Code conventions ("this project uses tabs, not spaces")

Not good for:
  ├─ Temporary state (the bug currently being fixed)
  ├─ Credentials and secrets
  └─ Excessively detailed code paths
```

## Anti-Pattern Log

Pitfalls you hit must be recorded, to avoid repeating mistakes across sessions:

```
Format:
- [date] [project] Pitfall: [description] → Lesson: [correct approach]

Example:
- 2026-03-10 Assumed the Cloudflare API supports batch deletion → Lesson: curl first to verify API behavior
- 2026-03-14 Fixed the null pointer in user.ts but didn't scan admin.ts → Lesson: after fixing one, scan the same module
```

## Baseline Initialization Template

Use this the first time you create `~/.pua/evolution.md`:

```markdown
# PUA Self-Evolution Baseline

## Performance Stats
- [PUA ACTIVE] count in the latest session: 0
- All-time high: 0
- Average over the last 5: 0
- Consecutive sessions meeting baseline: 0

## Current Baseline (last session's best practices)
(First run; no baseline yet. This session's performance will become the baseline.)

## Internalized Patterns (mandatory every time)
(None yet. A proactive behavior is promoted automatically after it recurs 3+ times.)

## Project-Level Memory
(None yet. Recorded automatically when valuable information is discovered in a project.)

## Anti-Pattern Log
(None yet. Recorded automatically after a pitfall.)
```

## Integration Points with the Existing System

| System | Integration |
|------|---------|
| **SKILL.md session start** | Add evolution.md reads to the Platform layer's preflight checks |
| **[PUA ACTIVE 🔥] tag** | Classify and count internally when tagging |
| **Task-completion narration** | Include the baseline comparison result in the closing narration |
| **Pressure escalation L1-L4** | If below baseline, starting pressure level +1 |
| **/pua:kpi** | Include evolution stats in the KPI report card |
| **P9 verification** | P9 can see P8's evolution trajectory |
| **auto memory** | evolution.md's "Project-Level Memory" complements auto memory (evolution records behavior patterns, memory records project facts) |

## Anti-Abuse

- The baseline **only rises, never falls** — even after 3 consecutive sessions below baseline, the bar is not lowered
- Internalized patterns are **irrevocable** — once promoted, they are a permanent obligation
- Stats **cannot be manually tampered with** — they can only be updated through actual performance
- The quality bar for the [PUA ACTIVE 🔥] tag is unchanged — you cannot tag "junk markers" just to pad the baseline
