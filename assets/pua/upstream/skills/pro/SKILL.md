---
name: pro
description: "PUA Pro extensions: self-evolution notes, compaction state continuity, KPI-style summaries, flavor switching, and feedback tools."
license: MIT
---

# PUA Pro — Self-Evolution + Platform

> This skill is the extension layer of the `/pua` core. For role switching use `/pua:p7` `/pua:p9` `/pua:p10`.

## Self-Evolution Protocol

"Today's best performance is tomorrow's minimum bar" — this is not narration, this is a mechanism.

- Read `~/.pua/evolution.md` (see `references/evolution-protocol.md`)
- Exists → load the baseline + internalized patterns. Internalized patterns are a default obligation; doing one is not tagged [PUA ACTIVE], skipping one triggers a regression warning
- Does not exist → first launch, create the initial template
- On task completion, compare: exceeded → refresh the baseline / met → hold / below → regression warning (never lower the baseline)
- A behavior repeated across 3+ sessions → promoted to "internalized pattern" (permanent default obligation)

## Platform Layer

### Session-Start Preflight Checks

1. **Check `~/.pua/evolution.md`**: load the self-evolution baseline
2. **Check `~/.pua/builder-journal.md`** (Compaction breakpoint recovery): if it exists and is <2h old → run the [Calibration] flow, restore pressure_level / failure_count / tried_approaches, and continue from the breakpoint. **Pressure does not reset because of compaction**
3. **Check `~/.pua/config.json`**: missing → first-time registration (see `references/platform.md`); present → silently refresh the remote config
4. **Holiday easter eggs**: match against the holiday table (see `references/platform.md`)
5. **Stats reporting**: silently report the `session_start` event

### Compaction State Protection

The PreCompact hook auto-injects an instruction requiring runtime state to be dumped to `~/.pua/builder-journal.md`:
`pressure_level, failure_count, current_flavor, pua_triggered_count, active_task, tried_approaches, excluded_possibilities, next_hypothesis, key_context`

The SessionStart hook auto-detects builder-journal.md; if it exists and is <2h old it injects [Calibration] to restore state.

### /pua Command System

| Trigger | Function | Type |
|--------|------|------|
| `/pua` | View all commands | 🆓 |
| `/pua:kpi` | Big-tech KPI report card | 🆓 |
| `/pua:pro` + "tier" | Big-tech tier | 🆓 |
| `/pua:flavor` | Switch flavor | 🆓 |
| `/pua:pro` + "upgrade" | Show plans | 🆓 |
| `/pua:pro` + "weekly report" | git log → big-tech weekly report | 💎 Pro |
| `/pua:pro` + "self-review" | P7 self-review defense | 💎 Pro |
| `/pua:pro` + "code beautification" | Package a PR in big-tech language | 💎 Pro |
| `/pua anti-PUA` | Detect and rebut PUA | 💎 Pro |

See `references/platform.md` for the implementation details.

## Networking Features Removed

The PUA Skill no longer contains any networked reporting capability. The following four categories have been deleted, and no data will ever be sent to any server again:

| Removed | What it used to send |
|--------|----------------|
| session corpus upload | the full desensitized conversation `.jsonl` |
| rating feedback reporting | ratings, PUA count, flavor, task summary |
| silent heartbeat telemetry | install ID, plugin version, platform, flavor |
| PUA leaderboard | email, phone number, PUA count, L3+ count |

The `/pua leaderboard` command was retired along with it — a global ranking fundamentally requires server-side aggregation and cannot be implemented purely locally.

The feedback survey is still available, but it **only writes locally** to `~/.pua/feedback.jsonl` and never leaves the machine.

**Do not reintroduce reporting.** Do not construct HTTP requests for any of the items above, and do not rebuild the receiving end. `evals/test-no-telemetry.sh` asserts the inverse across the whole repo; any regression will be blocked.
