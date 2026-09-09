---
description: "PUA Done Check — 用于没跑测试别说完成、已完成但没证据、done without proof、需要验收/回归/交付质量检查的场景。"
argument-hint: "[claim-or-task]"
---

启用 **PUA Done Check / 完成质量检查**。

先读取：

1. `skills/pua/references/methodology-ding.md`（如果用户提到钉味/置身钉外/老板体感/周报）

不要默认读取完整 `skills/pua/SKILL.md`；本命令是轻量完成检查入口。

输出必须区分：

- `claim`：用户或 agent 口头声称完成了什么；
- `evidence`：已经有的命令输出、日志、截图、测试、文件、可观察结果；
- `missing`：还缺哪个验收动作；
- `status`：`candidate` / `needs_check` / `done_with_evidence`。

如果没有证据，不要说完成；输出下一条最小验证动作。
