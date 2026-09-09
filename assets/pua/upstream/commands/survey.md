---
description: "PUA 调研问卷 — 7 部分交互式问卷收集用户反馈。/pua:survey。Triggers on: '/pua:survey', 'pua survey', '调研', '问卷', 'feedback survey'."
---

若参数是 `quick`，只询问一次本次效果（很有用 / 一般般 / 没感觉 / 这次跳过），先说明评分只记本地、不上传。用户选跳过或未作答时不写任何评分文件；用户明确选择记录后，使用宿主允许的写入工具向 `~/.pua/feedback.jsonl` 追加一条合法 JSON，包含 UTC 时间、真实评分、本任务实际风味和可选的简短摘要，不保存聊天全文。用 JSON 序列化而不是拼接 shell 字符串；无写入能力就只在当前对话回显并说明未落盘。无 AskUserQuestion（用户提问工具）时直接问一个简短问题，不阻断已完成的原任务。quick 模式结束后不要进入完整问卷。

否则读取本次实际插件根目录下的 `skills/pua/references/survey.md` 问卷文件；根目录来自宿主的 `CLAUDE_PLUGIN_ROOT`（插件根目录）或本命令真实安装位置，不相对业务工作目录猜路径。用 AskUserQuestion 逐部分引导用户回答。每部分 2-4 个问题一组，用户回答后进入下一部分。回答完毕后，在宿主允许本地记录时汇总为 JSON 写入 `~/.pua/survey-response.json`；无提问或文件工具时在当前对话完成，不冒充已经落盘。

**只写本地，不上传。** 问卷结果保存在用户自己机器上，PUA Skill 没有任何联网上报能力。不要尝试把它 POST 到任何地址。
