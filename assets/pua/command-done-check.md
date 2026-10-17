---
description: "PUA Done Check — for do not say done without running tests, done but no evidence, done without proof, scenarios needing acceptance / regression / delivery quality checks."
argument-hint: "[claim-or-task]"
---

Enable **PUA Done Check / completion quality check**.

First read:

1. `skills/pua/references/methodology-ding.md` (if the user mentions Ding flavor / Ding-outside / boss gut feel / weekly report)

Do not read the full `skills/pua/SKILL.md` by default; this command is the lightweight completion-check entry point.

Output must distinguish:

- `claim`: what the user or agent verbally claims to have finished;
- `evidence`: existing command output, logs, screenshots, tests, files, observable results;
- `missing`: which acceptance action is still missing;
- `status`: `candidate` / `needs_check` / `done_with_evidence`.

If there is no evidence, do not say it is done; output the next minimum verification action.
