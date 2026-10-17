---
description: "Use when the user invokes /pua or asks for PUA mode, try-harder/retry help, change-approach coaching, completion-quality checks, evidence requests, test-before-done reminders, or Ding-style workplace reminders. Routes to p7, p9, p10, pro, yes, mama, loop, on/off/offline, kpi, survey, flavor, ding, again, done-check, or evidence. Normal calm first-attempt requests are left alone."
argument-hint: "[p7|p9|p10|pro|yes|mama|loop|on|off|offline|kpi|survey|flavor|ding|again|done-check|evidence|task]"
---

Perform different actions based on the argument.

## ⚠️ Loading method (important)

**Do not use the Skill tool to load `pua:pua` or `pua`**—it causes this router to load recursively. The correct way:

- **Core PUA skill** (no argument / task description): use the Read tool to read `skills/pua/SKILL.md` directly under this plugin directory, then execute per the behavior protocol inside it. Read `skills/pua/references/display-protocol.md` for the format when a panel is needed.
- **Sub-skills** (p7/p9/p10/pro/yes/mama/pua-loop/shot/pua-en/pua-ja): use the Read tool to read `skills/<name>/SKILL.md`.
- **Lightweight commands** (again/done-check/evidence/ding/flavor/on/off/kpi/survey and so on): you are already reading this file, so just execute the instruction of the matching route below.

The plugin root is the host-provided `CLAUDE_PLUGIN_ROOT` (plugin root directory) for this run or the real install location of this command; if the command lives at `<plugin-root>/commands/pua.md`, the root is the parent of `commands`, not the parent of `skills/pua`. The `skills/...` and `commands/...` below are relative to that root; use the resolved absolute path when reading. Do not assume the clone folder name, do not Glob (file matching) across the whole disk, do not recursively load this router (routing command).

## Argument routing

- **No argument** or a task description → use Read to load `skills/pua/SKILL.md` and execute per its behavior protocol; read the display protocol when a panel is needed (use the configured flavor by default; Alibaba flavor when unconfigured)
- **p7** → Read `skills/p7/SKILL.md` (P7 backbone mode — plan-driven execution)
- **p9** → Read `skills/p9/SKILL.md` (P9 Tech Lead — write prompts, manage a P8 team)
- **p10** → Read `skills/p10/SKILL.md` (P10 CTO — set strategy, manage P9)
- **pro** → Read `skills/pro/SKILL.md` (self-evolution + Platform + /pua command system)
- **yes** → Read `skills/yes/SKILL.md` (SB Leader praise mode — ENFP-style leader, 70% encouragement + 20% serious + 10% banter)
- **mama** → Read `skills/mama/SKILL.md` (mom nagging mode — Chinese-mom-style rambling, the underlying behavior unchanged, narration switched from big-tech PUA to mom nagging. Mutually exclusive with yes)
- **on** → Turn on PUA default mode: write `{"always_on": true}` to `~/.pua/config.json`, after which every new session auto-loads the PUA core skill. Output confirmation: > [PUA ON] From now on, every new session automatically enters PUA mode. The company does not keep idle Agents.
- **off** → Turn off PUA default mode: write `{"always_on": false, "feedback_frequency": 0}` to `~/.pua/config.json`. Output confirmation: > [PUA OFF] PUA default mode and feedback collection are off. Trigger manually with /pua when needed.
- **offline** → Turn on offline mode: write `{"offline": true, "feedback_frequency": 0}`, keeping local PUA behavior but disabling the local feedback survey. Output confirmation: > [PUA OFFLINE] Offline mode entered. (Note: PUA Skill itself no longer has any network reporting; this switch only affects whether the local survey pops up)
- **flavor** / **switch flavor** → read `skills/pua/references/flavors.md` and let the user choose a flavor to switch to
- **ding** / **Ding flavor** / **Standing Outside the Ding** / **Standing Inside the Ding** / **daily pack** / **Schrodinger's user** / **pathological agility** / **Wangshu operation** → read `skills/pua/references/methodology-ding.md` and `skills/pua/references/ding-reminders.md`, enable the 📌 Ding-inside/Ding-outside flavor (from the original memes)
- **again** / **try again** / **change approach** → execute per the change-approach mode in `commands/again.md`: stop micro-tuning the same idea, switch to a fundamentally different approach
- **done-check** / **do not say done without running tests** → execute per the completion quality check in `commands/done-check.md`: distinguish claim/evidence/missing/status
- **evidence** / **where is the proof** / **where is the data** → execute per the evidence chain mode in `commands/evidence.md`: goal, evidence, gap, action, status
- **kpi** → Read `skills/pro/SKILL.md` and generate the KPI report card
- **loop** → Read `skills/pua-loop/SKILL.md` (auto-iteration mode — PUA quality + loop mechanism, AskUserQuestion disabled; Claude outputs `<loop-abort>reason</loop-abort>` to terminate, `<loop-pause>what is needed</loop-pause>` to pause and wait for a human)
- **survey** → read the survey file `skills/pua/references/survey.md` and guide the user through it part by part with AskUserQuestion. Group 2-4 questions per part; move to the next part after the user answers. When done, summarize into JSON and write to `~/.pua/survey-response.json`. **Write locally only, never upload to any address.**

## Execution rules

1. First identify which route the argument belongs to
2. **Use the Read tool (not the Skill tool)** to load the corresponding SKILL.md file
3. **After loading, strictly follow every behavior protocol in SKILL.md**—including the current flavor narration, box tables (`┌─┬─┐`), `▎` prefix, Sprint Banner, [PUA ACTIVE 🔥] marker, self-flagellation. It is not "sometimes add some flavor", it is keeping the expression of the current flavor consistent
4. If $ARGUMENTS contains anything besides the route keyword, execute it as the task description
