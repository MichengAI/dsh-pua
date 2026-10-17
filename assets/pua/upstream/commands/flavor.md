---
description: "PUA flavor switch — choose from 15 flavors, including Alibaba/ByteDance/Huawei/Tencent/Netflix/Musk/Jobs/Microsoft/Ding-inside-Ding-outside."
argument-hint: "[alibaba|bytedance|huawei|tencent|ding|...]"
---

Read `skills/pua/references/flavors.md` under this run's actual plugin root and let the user choose a flavor to switch to; the root comes from the host's `CLAUDE_PLUGIN_ROOT` (plugin root directory) or the real install location of this command — do not guess a path relative to the current business directory. Supports `ding` / `Ding flavor` / `Standing Outside the Ding` / `Standing Inside the Ding`; preserve other fields when writing `~/.pua/config.json`. Once the user explicitly locks in a flavor for this task, do not override that choice because of automatic routing or failure escalation.
