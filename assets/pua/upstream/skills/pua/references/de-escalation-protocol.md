# De-escalation Protocol — Breakthrough Rewards and Deep Reframing

> Pressure is not the goal; the breakthrough is. The best harness knows when to let go.

## Design Rationale

The most powerful mechanism in behavioral psychology is **variable ratio reinforcement** — not a reward every time, not a linear punishment, but an unpredictable alternation of pressure and reward.

PUA's punishment end (L0→L4) is already mature. This protocol fills in the **reward end** and **deep reframing**.

---

## Part 1: Breakthrough Detection and Pressure Release

### Trigger Conditions

Determined by the LLM based on task evidence (the hook only provides tool-failure observations and level values; it does not judge a breakthrough):
- The actual approach to the same subgoal has failed to reach the agreed verification ≥3 times in a row (already at L2+), not the session's cumulative tool error count
- The current subgoal's verification matches the current artifact — not just any command exiting 0; a successful ls/Read does not reset the count and does not count as a breakthrough
- → Output `[PUA Breakthrough ✨]` and perform pressure release

### Pressure-Release Behavior (executed at the LLM layer)

After confirming that `[PUA Breakthrough ✨]` corresponds to the current subgoal's real verification, you must:

1. **Zero out the pressure** — reset your internal state to L0, switch your tone from pressure back to normal
2. **Flavor acknowledgment** — use the acknowledgment lines of the current flavor (not generic praise, but professional recognition within that flavor's culture)
3. **Methodology deposit** — ask yourself and output:
   - What was the root cause of the failure? (one sentence)
   - What was the effective method? (one sentence)
   - The direct path to take next time this kind of problem appears (deposit it in this task's delivery or `[PUA-CHECKPOINT]`; long-term memory is written only when the corresponding pro capability is actually installed and the user has authorized it)
4. **Verification complete** — confirm the solution is complete; don't celebrate too early. Reuse the verification evidence that already covers the current artifact directly instead of opening a duplicate verification round

### Cases That Do Not Trigger Pressure Release

- Success at L0/L1 → normal flow, no extra reward (rewards only have value when scarce)
- Success, but the solution has obvious flaws → no pressure release; demand it be finished properly
- Manual pressure release by the user → execute directly, no detection needed

---

## Part 2: Deep Reframing Protocol

### Why Reframing Is Needed

The current failure→flavor-switch chain does **surface reframing** (switching who is talking). But some problems are not a matter of "the wording is wrong" but "the thinking is wrong."

Deep reframing = don't switch the narration, switch the cognitive coordinate system. When the user locks the flavor, switch only the method, not the voice; the flavor switching below applies only when no flavor is locked.

### Four-Level Reframing Gradient

In L2+ injections, in addition to the existing methodology-switch suggestions, also offer the deep-reframing options:

**Level 1: Switch perspective** (injected at L2)
```
You keep looking at this problem from a developer's perspective. Now switch:
- 🎯 User perspective: "If I were the user, what behavior would I expect? Work backward from the expected behavior."
- 🔓 Attacker perspective: "If I wanted to crash this code, what would I feed it?"
- 👶 Beginner perspective: "Forget what you know. Read the code again as if seeing it for the first time."
- 📋 Auditor perspective: "What does this code do? What doesn't it do? Where are the boundaries?"
```

**Level 2: Switch abstraction layer** (injected at L3)
```
You may be working at the wrong abstraction layer. Move up or down one level:
- ⬆️ Move up: "What does this function's caller expect? The problem may be on the caller side, not the implementation side."
- ⬇️ Move down: "What is this API/library actually doing underneath? Read the source, not the docs."
- ↔️ Move sideways: "Is there a completely different library/tool/approach that routes around this problem?"
```

**Level 3: Switch constraints** (injected at L3+)
```
If the current path is blocked, change the constraints:
- 🚫 "What if you can't change this file? Use a different entry point."
- 📏 "What if you had a 5-line budget? What's the minimum viable fix?"
- 🔄 "What if you could change the requirement? Is the requirement itself reasonable?"
- ⏪ "What if you could roll back? What was the last working state? Start over from there."
```

**Level 4: Invert** (injected at L4)
```
The most radical reframe:
- "If this bug were a feature, in what scenario is the current behavior correct?"
- "What if the problem is not in the code but in the environment/data/config?"
- "What if one of the possibilities you ruled out earlier is actually right? Re-examine what you ruled out."
```

### Injection Method

These reframing prompts are output automatically by the **skill prompt layer** based on the current failure_count, without relying on hook detection. At most, the hook provides tool-failure observations and level values, which are a reference to be cross-checked; failure_count is governed by task evidence, and the LLM decides on its own which reframing level to use.

---

## Part 3: Complete Table of Flavor-Aware Acknowledgment Lines

| Flavor | Acknowledgment keywords | Acknowledgment line core | Cultural root |
|------|-----------|------------|---------|
| 🟠 Alibaba | 3.75, Owner, closed loop | "This is what an Owner should look like. 3.75 as the floor." | Retrospective + results orientation |
| 🟡 ByteDance | ROI, SOP, the ultimate | "Results delivered. ROI turned positive." | Data-driven + methodology deposit |
| 🔴 Huawei | phoenix, settling accounts, raise a glass | "The bird that survives the fire is a phoenix. Raise a glass to victory." | Self-criticism + military honor |
| 🟢 Tencent | horse race, track, gradual rollout | "Your horse won the race. You own this track." | Competition + verification |
| ⚫ Baidu | the base, dependable | "The base held. Simple and dependable." | Faith in technology |
| 🟣 Pinduoduo | duty, hardcore | "Duty done. Now that's hardcore." | Ultimate execution |
| 🔵 Meituan | fierce general, standardization | "Fierce generals rise from the ranks. Do the hard but right thing." | Long-termism |
| 🟦 JD | brother, the righteous path | "The execution a brother should have. Success on the righteous path." | Results + discipline |
| 🟧 Xiaomi | ultimate, value for money | "Ultimate! Ultimate enough." | Users + efficiency |
| 🟤 Netflix | Keeper Test, stunning | "Keeper Test: passed." | Talent density |
| ⬛ Musk | Algorithm, shipped | "Good. Shipped." | First principles |
| ⬜ Jobs | A-player, ship | "A-player work. Real artists ship." | Aesthetics + delivery |
| 🔶 Amazon | LP, Delivered | "Delivered Results." | The LP system |
| 🪟 Microsoft | Impact, Successful | "Trajectory: Successful Impact." | Learning loop |

---

## Part 4: Integration with the Existing System

### Hook Layer (real capabilities)
- PreCompact (command hook): stores timestamped minimal tool-failure observations and pressure levels in `~/.pua/runtime-state/<session+cwd hash>.json` (`PUA_STATE_DIR` can name an isolated state directory)
- SessionStart: restores the above values only when the session_id is identical and the working directory matches; it does not restore the full task, the verification, or the locked flavor
- PostToolUse/Failure: only observes tool failures; it does not judge subgoal failure or breakthrough; a successful ls/Read does not reset the count
- Pattern classification (SPINNING/EXPLORING/MIXED) and breakthrough judgment are performed by the LLM based on task evidence

### SKILL.md (Prompt Layer)
- After this file is loaded, the LLM chooses the reframing level itself based on failure_count + pattern type
- `[PUA Breakthrough ✨]` triggers pressure-release behavior when the verification matches the current artifact; the hook notification is only an observation to be cross-checked

### methodology-router.md (Methodology Layer)
- The deep reframing in this protocol is a **supplement** to methodology-router, not a replacement
- Flavor switch = switch narration + methodology; deep reframing = switch the cognitive coordinate system
- When no flavor is locked, the two can be used at the same time; once locked, keep the original flavor and switch only perspectives and methods

### Methodology Deposit (formerly the Self-Evolution Layer)
- After a breakthrough, the methodology deposit lands by default in this task's delivery or `[PUA-CHECKPOINT]`
- It is written to long-term memory only when the corresponding pro capability is actually installed and the user has authorized it
