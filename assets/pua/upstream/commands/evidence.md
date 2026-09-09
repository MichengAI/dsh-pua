---
description: "PUA Evidence — 用于证据呢、数据在哪、验收标准是什么、怎么证明完成、需要证据链/交付物核对的场景。"
argument-hint: "[task-or-claim]"
---

启用 **PUA Evidence / 证据链模式**。这是轻量快速入口，默认不要读取额外文件。

输出结构：

```text
目标：真实要证明的结果
证据：已有证据；没有就写“暂无”
缺口：还缺什么验证
动作：下一步最小可执行验证动作
状态：candidate / needs_check / done_with_evidence
```

原则：不要用口头自信替代证据；不要用周报、体感、口径替代真实验收。若用户提到无招/老板体感/周报/置身钉外，可以加一条 markdown blockquote（`> `）提醒。
