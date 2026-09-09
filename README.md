# DSH PUA

为当前 DSH 任务开启 PUA 工作模式：保留大厂风味，要求诊断先行、换方法和证据化验收。

社区插件，包名 `@michengai/dsh-pua`，当前版本 `0.1.1`。开发状态和阅读顺序见[交接入口](docs/00-交接入口/00-阅读导航.md)。

## 能做什么

- 默认关闭，按会话显式开启或关闭。
- 支持原版 15 种风味及对应方法论，每次只注入选中的内容。
- 对当前任务发起换方法、完成检查和证据检查。
- 使用原版快速入口的结构化输出；只读审查可附当前仓库的真实 Git 索引事实。
- 从成功的原生命令日志恢复开关和风味；不同会话隔离，分叉不继承配置。
- 不需要 Bash、Python、jq、额外模型密钥或前端构建。

本版不自动统计失败次数、不自动升压、不阻止模型结束、不调度团队、不执行长期记忆写入。L0–L4 由模型依据当前子目标的真实实验判断，不能把工具报错直接当作方案失败。PUA 不扩大用户授权。

## 环境

Node.js >= 22.19，DSH `0.1.2-rc.1`，宿主提供 `commands` 和 `systemPrompt` 服务。其他版本尚未验证。可以在具备这些服务的 DSH Web 或桌面宿主中加载，不依赖某个桌面壳。

审查预检可选使用宿主 `subprocess` 服务和 Git；缺少服务、非 Git 目录、执行失败或截断时明确标注未获取证据，不阻断其他命令。没有独立设置页面，开关和风味通过下列命令配置。

## 本地开发与安装

当前尚未发布到 npm。先在项目目录执行：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
npm ci --ignore-scripts
npm run check
npm pack
```

将生成的包安装到你要使用的 DSH profile。下例中的 `web` 是显式示例，请替换为实际 profile：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web add .\michengai-dsh-pua-0.1.1.tgz --ignore-scripts
```

等待当前任务结束后重载 DSH 后端，在支持原生命令的界面输入 `/pua help`。浏览器刷新不一定会重载后端插件。若已有插件注册 `/pua`，先解决命令冲突。

## 命令

| 输入 | 行为 |
| --- | --- |
| `/pua` | 开启模式，对当前任务发送继续处理请求 |
| `/pua 修复登录失败` | 开启模式，把明确任务排到后续轮次 |
| `/pua review [范围]` | 开启模式，提交只读审查；预检当前会话所属 Git 仓库索引 |
| `/pua on` | 开启当前会话模式，下次模型步骤生效，不唤醒模型 |
| `/pua off` | 关闭当前会话模式，下次模型步骤撤去风味，不取消正在执行的操作 |
| `/pua flavor` | 列出风味 |
| `/pua flavor huawei` | 锁定华为味；关闭时仅保存选择，不自动开启 |
| `/pua again` | 开启模式，要求当前任务换一种实质不同的方法 |
| `/pua done-check` | 开启模式，核对当前交付及验收证据 |
| `/pua evidence` | 开启模式，梳理当前证据链和未证明部分 |
| `/pua status` | 显示当前开关、风味和状态范围 |
| `/pua help` | 查看用法 |
| `/pua -- on feature` | 把以保留命令单词开头的文本作为任务 |

风味标识：`alibaba`、`bytedance`、`huawei`、`tencent`、`baidu`、`pinduoduo`、`meituan`、`jd`、`xiaomi`、`netflix`、`tesla`（Musk）、`apple`（Jobs）、`amazon`、`microsoft`、`ding`。支持对应中文名和 `musk`、`jobs` 别名。默认阿里味，首版不自动切换风味。

输入限制 8 KiB，控制命令不接受额外参数，风味必须在白名单中。命令不接收图片附件。命令返回“已提交”仅表示已入队，模型实际交付与验证结果需要查看后续回复。

兼容 `/pua pua flavor` 等单层重复前缀；`in`、`onn` 等疑似拼错和 `loop`、`p9` 等未实现模式会返回提示，不唤醒模型。需要保留原文时使用 `/pua -- 原文`。支持“换个方法”“证据呢”“验收”等精确中文快捷入口；“审查一下项目”“你来评估一下项目”等完整短句进入 review，带“然后修复”等附加目标的任务仍按原文处理。

review 的范围参数是审查说明，不是 shell 参数。Git 预检总预算 10 秒、单次标准输出上限 1 MiB，只读取索引；提供总数、最多 20 条路径样本（单条最多 240 字符）和常见目录的跟踪数。样本是否完整另行标注，跟踪不等于已经提交或推送。跨命令读取非原子快照，换仓库或发生改动需要重新核对。预检记录进入本次 Agent 请求及宿主会话日志，不读取文件正文。

## 状态与关闭语义

配置从宿主 `command/run` 与成功的 `command/done` 配对恢复，不读取 `~/.pua`，不新建自定义会话事件，也不另存完整任务或错误文本。宿主按自己的 checkpoint/flush 机制写盘；未落盘的最后操作在崩溃后可能丢失。新会话和分叉默认关闭。当前会话中的新业务目标不会自动关闭模式，请按需 `/pua off`。

关闭后保留风味选择，后续模型步骤收到停用说明；已经发出的模型请求和工具调用不会被撤回。之前排队的明确任务仍会正常执行，不能借历史 `/pua` 请求重新激活模式。卸载不撤销 Agent 已做的代码修改，也不会删除宿主历史。重新安装后同会话仍可从历史恢复配置，若要保持关闭请先执行 `/pua off`。

使用 complete system prompt 的自定义 Agent 可能压制插件的普通提示词 section，这类宿主配置不在首版支持范围内。

## 卸载与恢复

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web remove @michengai/dsh-pua
```

按宿主要求重载后端。插件只管理自己的命令和提示词贡献。源码未提交时请自行保留工作目录；用户任务中的文件修改需按该任务的版本控制或备份恢复。

## 工程结构

| 路径 | 用途 |
| --- | --- |
| `src/index.ts` | 插件注册与动态提示词 |
| `src/command.ts`、`src/args.ts` | 命令执行与参数解析 |
| `src/state.ts` | 从会话自己的命令日志恢复状态 |
| `src/review.ts` | 只读审查协议和有界 Git 索引预检 |
| `src/content.ts`、`src/flavors.ts` | DSH 契约、风味白名单及素材选择 |
| `assets/pua` | 固定来源素材与文件指纹 |
| `tests` | 参数、宿主服务、状态和生命周期测试 |
| `scripts/verify.mjs` | 素材、包元数据、提示词体积和文档链接校验 |
| `docs` | 当前状态、架构和迭代验收记录 |

## 验证边界

本项目的 20 项自动化测试不调用外部模型。宿主服务测试使用真实 DSH 注册、会话和提示词实现；真实 AgentLoop 配合固定响应的离线适配器验证实际请求中的开关、审查协议和验收模板。真实 Git 临时仓库验证忽略目录与索引的区别。安装检查通过临时内存会话验证实际安装文件。模型行为效果、真实桌面交互及跨平台安装需要单独验证。不能用工具次数或施压话术数量证明效率提升。

## 来源与许可

实现采用 MIT。PUA 原版素材来自 [tanweai/pua](https://github.com/tanweai/pua)，固定为 3.5.1 的 `e6e6cd2`，作者与许可证据详见 [NOTICE](NOTICE) 和 [素材清单](assets/pua/upstream.json)。公开发布前须复核上游独立许可及署名要求。未宣称这是官方 PUA 或 DeepSeek 插件。
