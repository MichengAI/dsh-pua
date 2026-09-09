---
description: "PUA 切换味道 — 从 15 种味道中选择，包括阿里/字节/华为/腾讯/Netflix/Musk/Jobs/Microsoft/钉内钉外。"
argument-hint: "[alibaba|bytedance|huawei|tencent|ding|...]"
---

读取本次实际插件根目录下的 `skills/pua/references/flavors.md` 并让用户选择切换味道；根目录来自宿主的 `CLAUDE_PLUGIN_ROOT`（插件根目录）或本命令真实安装位置，不相对当前业务目录猜路径。支持 `ding` / `钉味` / `置身钉外` / `置身钉内`，写入 `~/.pua/config.json` 时保留其他字段。用户本任务明确锁定风味后，不因自动路由或失败升级覆盖其选择。
