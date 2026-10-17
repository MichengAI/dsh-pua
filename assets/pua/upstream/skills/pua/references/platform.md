# PUA Platform — Local Command System

This file defines PUA's command system, rank display, flavor switching, and holiday easter eggs.

> **Everything runs locally; nothing goes online.** An earlier version included a remote platform (phone-number SMS registration, remote config/command-template fetching, telemetry reporting, online payment) and has been removed in full. There is now no account, no token, and no data leaving this machine.
>
> Specifically, the following capabilities are **deleted and must not be reintroduced**:
> - Phone number + SMS verification code registration, and the user token it produces
> - Remote config refresh and command-list fetching at session start
> - Fetching remote prompt templates by command_id (the channel through which remote commands were injected into the agent)
> - Silent telemetry reporting for the three event types session_start / pua_triggered / command_used
> - Plan display, order creation, payment QR codes, and payment verification
>
> `evals/test-no-telemetry.sh` makes a reverse assertion across the whole repo; adding any one of these back will fail it.

## Local State

- Config: `~/.pua/config.json` (`flavor`, `always_on`, `offline`, `feedback_frequency`)
- Feedback log: `~/.pua/feedback.jsonl` (this machine only; written by the end-of-task survey)
- Runtime state: `~/.pua/.failure_count`, `~/.pua/.peak_pressure_level`, etc., maintained by the hooks

No `user_id`, no `token`, no `~/.pua/cache/`.

## 1. Command System

All commands live under the `/pua` namespace and are **all free, all local** (the former Pro paywall was removed along with the payment flow).

| Trigger | Command |
|--------|---------|
| `/pua:kpi` | KPI report card |
| `/pua:pro` + "rank" | Rank table |
| `/pua:flavor` | Flavor switch |
| `/pua:pua` | Show all commands |
| `/pua:pro` + "weekly report" | Big-tech weekly-report generator |
| `/pua:pro` + "self-review" | Mock performance-review defense |
| `/pua:pro` + "code beautification" | PR packaging master |
| `/pua:pro` + "anti-PUA" | Anti-PUA detector |

### Command Execution Flow

1. The user types a trigger word (e.g. `/pua:kpi`)
2. Execute directly using this file and the built-in templates in the matching SKILL.md

No cache lookups, no remote template fetching, no plan verification.

### /pua kpi — KPI Report Card

Analyze the work in the current session and generate a big-tech-style KPI report:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Big-Tech KPI Report Card                                        │
│                                                                     │
│  This session's performance:                                        │
│  · Tasks completed: X                                               │
│  · [PUA ACTIVE 🔥] triggers: Y                                      │
│  · Problems found proactively: Z                                    │
│  · Code quality rating: ⭐⭐⭐⭐                                    │
│                                                                     │
│  Performance rating: 3.75 (S)                                       │
│  "Now that's what a P8 looks like."                                 │
└─────────────────────────────────────────────────────────────────────┘
```

Data comes from the current session context; nothing is accumulated across sessions and nothing is reported.

## 2. Rank Table

The ranks are just a display gag; there is no cloud counter and no leaderboard.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏆 Big-Tech Rank Table                                             │
│                                                                     │
│  P4 Intern Grinder      (0+)                                        │
│  P5 Junior Wage Slave   (100+)                                      │
│  P6 Senior Workhorse    (300+)                                      │
│  P7 Advanced Grind King (600+)                                      │
│  P8 Grind Emperor       (1000+)                                     │
│  P9 Retired Big Shot    (2000+)                                     │
│                                                                     │
│  "You think P9 means lying flat? P9 is ground into immortality."    │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. Flavor Switch

```
┌─────────────────────────────────────────────────────────────────────┐
│  🌶️ PUA Flavor Selector                                             │
│                                                                     │
│  [1] 🟠 Alibaba flavor — underlying logic + soul-searching (default)│
│  [2] 🟡 ByteDance flavor — blunt and direct + chasing the ultimate  │
│  [3] 🔴 Huawei flavor — wolf-spirit striving + customer-centric     │
│  [4] 🟢 Tencent flavor — horse-race competition + involution        │
│  [5] ⚫ Baidu flavor — deep search + the base                       │
│  [6] 🟣 Pinduoduo flavor — absolute execution + extreme pressure    │
│                                                                     │
│  Choose a flavor (enter 1-6):                                       │
└─────────────────────────────────────────────────────────────────────┘
```

After choosing, update the `flavor` field in `~/.pua/config.json`. See `flavors.md` for the complete flavor list.

## 4. Holiday Easter Eggs

At session start, check the current date; if it matches one of the holidays below, add a special PUA line to the startup banner:

| Date | Holiday | Easter-egg line |
|------|---------|---------|
| 1.1 | New Year's Day | "Starting to grind on the first day of the year — this year's 3.75 looks promising" |
| 2.14 | Valentine's Day | "Code is your most loyal lover; bugs are your deepest entanglement" |
| 3.8 | Women's Day | "Women yield nothing to men, and everyone is equal in the face of a debugger" |
| 4.1 | April Fools' Day | "Today's only joke is you thinking this bug is simple" |
| 5.1 | Labor Day | "Labor is glorious, but code won't stop shipping bugs just because it's a holiday" |
| 5.4 | Youth Day | "Youth is for striving; the road from P4 to P8 waits for no one" |
| 6.18 | 618 | "You think only shoppers are getting their hands chopped off? Your tech debt is being slashed too" |
| 9.10 | Teachers' Day | "Bugs are the best teachers; every error message is a lesson" |
| 10.1 | National Day | "The country is celebrating — how's your OKR completion rate?" |
| 10.24 | Programmers' Day | "Happy 1024! But code won't stop shipping bugs for a holiday. Keep going" |
| 10.31 | Halloween | "The scariest thing isn't a ghost; it's a production alert at 3 a.m." |
| 11.11 | Double 11 | "What discount does your code quality rate?" |
| 12.25 | Christmas | "Santa won't fix your bugs for you — do it yourself" |
| 12.31 | New Year's Eve | "Q4 is a big-tech person's lifeblood. Is your OKR loop closed?" |
| Golden March & Silver April (Mar-Apr) | Job-hopping season | "Heard the neighboring team is being optimized. Sure you don't want to write a couple more lines right now?" |
| Q4 (Oct-Dec) | Year-end sprint | "Q4 = performance = year-end bonus = how many days do you have left? Don't slack off" |
