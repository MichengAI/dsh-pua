# DSH PUA

基于 PUA 3.5.1 完整协议文本的 DSH 适配实现。保留原版核心、领导人格、旁白、Banner、诊断与验收文本，适配 DSH 命令、设置和主要生命周期；不执行原版 Bash hooks。文本保真不等于模型行为已通过验收。

社区插件 `@michengai/dsh-pua`，当前版本 `0.2.0`。开发状态见[交接入口](docs/00-交接入口/00-阅读导航.md)，平台差异见[架构说明](docs/03-技术架构/01-插件架构.md)。

## 与原版的关系

- 固定提交 `e6e6cd237ad17750d179674bff52f8184abea8fd`，原文按 Git 对象字节保存并校验 SHA-256。
- 完整注入核心、展示协议和方法论路由，保留 15 种风味。auto 由模型按原版任务路由选择，显式选择则锁定。
- P7、P9、P10、Pro、Yes、Mama、Shot、英文和日文模式加载完整原版协议；资料工具提供完整关联文档。
- 原版失败候选模板接到真实终端结果；保留条件门控，工具失败不直接变成任务失败。
- 显式 Loop 接到 Agent 停止边界，支持独立验收、暂停、中止、取消和轮次上限。

原版 Bash hooks 不在本机执行。DSH 命令名不支持冒号，因此 `/pua:p9` 对应 `/pua p9`。团队进程、worktree 和工具权限由 DSH 及所属插件管理，不将 Claude Code 管理脚本视为跨宿主通用实现。

## 环境与安装

Node.js >= 22.19，已验证 DSH `0.1.2-rc.1`。必需 `commands`、`systemPrompt`；完整体验需要宿主 `tools`、`settings`、AgentLoop。Oracle 和 Git 预检使用 `subprocess`。不需要额外模型密钥。

当前尚未发布到 npm。安装最新源码修复时，在项目目录构建并安装到实际使用的 profile：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
npm ci --ignore-scripts
npm run check
npm pack
dsh plugin --profile web add .\michengai-dsh-pua-0.2.0.tgz --ignore-scripts
```

这里的 `0.2.0.tgz` 由上一行 `npm pack` 生成。使用本次审查修复的现成本地包时，直接安装实际文件名：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web add .\michengai-dsh-pua-0.2.0-review-fix.tgz --ignore-scripts
```

此前的 `michengai-dsh-pua-0.2.0-local.tgz` 保留用于回退，不包含本次审查修复。

等待当前任务结束后重载 DSH 后端。浏览器刷新不一定重载插件；用 `/pua help` 确认能看到 P9、Loop 等入口。同版本重新打包时使用新文件名，避免包管理器复用旧内容。

## 设置页面

在 DSH 标准设置页查找 `michengai-pua`。插件通过 settings schema 提供默认开启、默认风味、离线模式、反馈提醒频率；schema 注册已验证，桌面显示与交互仍待实际验收。

有 settings 时默认开启、auto 选味。`on`、`off`、`flavor` 同步 profile 默认，当前会话显式选择优先。分叉不继承父会话命令或循环，使用 profile 默认。没有 settings 的宿主降级为当前会话，默认关闭。

离线模式关闭自愿反馈提醒；任何设置下都没有联网刷新或上报能力。反馈默认每 5 次有可见 PUA 输出的交付提醒一次，0 关闭，提醒不会唤醒模型或记录评分。

## 命令

| 输入 | 行为 |
| --- | --- |
| `/pua [任务描述]` | 开启完整核心；明确任务排到后续轮次，无描述则继续当前任务 |
| `/pua on`、`/pua off` | 开关；off 同时取消本会话循环及其独立验收 |
| `/pua flavor [名称或auto]` | 列表、锁定风味或恢复自动路由，不唤醒模型 |
| `/pua p7 [任务]` | 原版 P7 方案驱动模式 |
| `/pua p9 [任务]`、`/pua p10 [任务]` | 原版技术负责人、战略层协议，使用宿主实际可用子代理能力 |
| `/pua pro [任务]` | 自进化、KPI、周报等完整本地协议；写入依赖宿主文件工具和授权 |
| `/pua yes [任务]`、`/pua mama [任务]` | 原版夸夸模式、妈妈模式 |
| `/pua shot [任务]` | 原版 Shot 文本及完整核心 |
| `/pua pua-en [任务]`、`/pua pua-ja [任务]` | 原版英文、日文技能 |
| `/pua ding [任务]` | 钉内/钉外味 |
| `/pua again [补充]` | 原版换方法协议 |
| `/pua done-check [补充]`、`/pua evidence [补充]` | 原版完成检查、证据检查 |
| `/pua review [范围]` | DSH 扩展：只读审查，附有界 Git 索引预检 |
| `/pua loop "任务" --verify "npm test" --max-iterations 10` | 独立验收循环，配置不由模型输出改写 |
| `/pua cancel-pua-loop`、`/cancel-pua-loop` | 取消当前循环，包括尚未开始的排队循环 |
| `/pua kpi`、`/pua survey [quick]` | KPI 报告、本地问卷；用户明确选择后才记录评分 |
| `/pua offline` | 关闭反馈提醒，保持无上报能力 |
| `/pua team-status` | 当前会话及直接子代理状态、当前循环状态 |
| `/pua reap-orphans` | 说明资源管理状态，不删除其他插件资源 |
| `/pua teardown-all` | 取消本插件在当前后端管理的全部循环，不删除 worktree |
| `/pua status`、`/pua help` | 开关、模式、失败观察、循环与用法 |
| `/pua -- on feature` | 将以保留命令开头的文字作为任务 |

风味：`alibaba`、`bytedance`、`huawei`、`tencent`、`baidu`、`pinduoduo`、`meituan`、`jd`、`xiaomi`、`netflix`、`tesla`（Musk）、`apple`（Jobs）、`amazon`、`microsoft`、`ding`，支持中文名及 `musk`、`jobs` 别名。

普通消息 `huawei` 不等于切换命令，请用 `/pua flavor huawei`。输入上限 8 KiB，不接收图片附件。“已提交”只表示入队。

## 循环、恢复与关闭

Loop 必须显式启动，省略上限为原版无限模式，省略 `--verify` 为 honor system，不能声称独立验收通过。Windows Oracle 使用 PowerShell，在会话工作目录执行，超时 120 秒，stdout/stderr 各最多保留 8 KiB。命令通过不代表测试文件不可能被修改；这不是操作系统级隔离沙箱。

启动任务中的 `PUA_LOOP_START` 包含完整 `--verify` 命令，对模型可见。命令 ID 校验用于阻止旧排队请求恢复旧配置；验证命令不由模型输出改写，但验证文件和执行环境没有不可篡改保证。

模型输出 `<promise>LOOP_DONE</promise>` 后触发 Oracle；失败继续，连续 3/5 次拒绝触发反思。`<loop-pause>需要什么</loop-pause>` 暂停，用户在同会话补充后恢复；`<loop-abort>原因</loop-abort>` 中止。用户取消、异常结束、卸载均取消续轮，恢复会话不会自行唤醒模型。

会话命令与运行记录保存在宿主日志，不新增未知必需事件。失败观察保存计数和最近 128 个调用 ID 哈希；Loop 保存任务、用户验证配置、迭代与独立验证摘要。压缩后恢复数字观察，不将其当作任务失败或验收结论。clear 清除运行观察。

源码审查修复使用宿主 `surface replace` 将每条 `PUA_RUNTIME_V1` 替换为简短运行说明：完整 JSON 留在日志供恢复，后续模型请求不重复接收它。旧会话中仍可见的原始记录在下一次模型步骤前替换；过去已经发出的请求保持原样，卸载后宿主仍能按日志重建替换结果。命令状态只消费新增事件，设置变化仍会刷新默认值。

off 后后续步骤收到停用说明；已发出的普通模型请求和工具调用不撤回，已排队用户任务仍正常处理。卸载保留宿主历史与业务文件。用 complete system prompt 压制普通 section 的 Agent 不在当前支持范围内。

## 验证与开发结构

测试覆盖真实 DSH 命令、settings、资料工具、AgentLoop、原文保真、状态恢复、循环控制和真实 Git/PowerShell。固定回复适配器只证明请求及控制链正确，不证明真实模型遵循程度或任务效率。

| 路径 | 用途 |
| --- | --- |
| `src/content.ts`、`src/source.ts` | 原文校验、完整拼装、资料白名单 |
| `src/command.ts`、`src/args.ts`、`src/state.ts` | 命令与会话状态 |
| `src/runtime.ts`、`src/hook-content.ts` | hook 模板、观察、Loop 与生命周期 |
| `src/settings.ts` | DSH 设置 schema 和持久默认 |
| `src/review.ts` | 有界只读 Git 索引证据 |
| `assets/pua/upstream` | 85 个原版文件，旧 19 份素材保留兼容 |
| `scripts/verify.mjs`、`scripts/smoke-package.mjs` | 素材、文档、预算与实际安装校验 |

## 卸载与回退

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web remove @michengai/dsh-pua
```

撤销本次审查修复、保留 0.2.0 功能时，重新安装此前的本地包，再等待当前任务结束后重载后端：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web add .\michengai-dsh-pua-0.2.0-local.tgz --ignore-scripts
```

如需跨版本回退到 0.1.1，可安装保留的 `michengai-dsh-pua-0.1.1-final.tgz`。0.1.1 忽略新增设置，新增命令历史不保证被旧版本正确恢复，建议旧版本新开会话。

## 来源与许可

实现采用 MIT。原版来自 [tanweai/pua](https://github.com/tanweai/pua)，固定为 3.5.1。署名及许可边界见 [NOTICE](NOTICE)，指纹见[素材清单](assets/pua/upstream.json)。本项目不是 PUA 或 DeepSeek 官方插件。
