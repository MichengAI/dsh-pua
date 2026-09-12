# DSH PUA

基于 PUA 3.5.1 完整协议文本的 DSH 适配实现。保留原版核心、领导人格、旁白、Banner、诊断与验收文本，适配 DSH 命令、设置和主要生命周期；不执行原版 Bash hooks。文本保真不等于模型行为已通过验收。

社区插件 `@michengai/dsh-pua`，当前版本 `0.3.8`。开发状态见[交接入口](docs/00-交接入口/00-阅读导航.md)，平台差异见[架构说明](docs/03-技术架构/01-插件架构.md)。

## 与原版的关系

- 固定提交 `e6e6cd237ad17750d179674bff52f8184abea8fd`，原文按 Git 对象字节保存并校验 SHA-256。
- 完整注入核心、展示协议和方法论路由，保留 15 种风味。auto 由模型按原版任务路由选择，显式选择则锁定。
- P7、P9、P10、Pro、Yes、Mama、Shot、英文和日文模式加载完整原版协议；资料工具提供完整关联文档。
- 原版失败候选模板接到真实终端结果；保留条件门控，工具失败不直接变成任务失败。
- 显式 Loop 接到 Agent 停止边界，支持独立验收、暂停、中止、取消和轮次上限。

原版 Bash hooks 不在本机执行。DSH 命令名不支持冒号，因此 `/pua:p9` 对应 `/pua p9`。团队进程、worktree 和工具权限由 DSH 及所属插件管理，不将 Claude Code 管理脚本视为跨宿主通用实现。

## 环境与安装

Node.js >= 22.19，支持 DSH `0.1.2-rc.1`、`0.1.5-rc.1`、`0.1.5-rc.2`，开发依赖固定 `0.1.5-rc.2`。必需 `commands`、`systemPrompt`；完整体验需要宿主 `tools`、`settings`、AgentLoop。Oracle 和 Git 预检使用 `subprocess`。不需要额外模型密钥。

上述范围经过真实宿主服务的离线回归；真实模型、钉钉会话和桌面设置交互仍待验收。`0.1.0-rc.8`、`0.1.1-rc.2` 缺少本插件所需日志接口，不在支持范围。旧 `0.2.0` 包不支持新版宿主，升级 DSH 后请使用 `0.2.1` 或更新版本。Web 配置入口需要宿主客户端插件、设置、会话及 Typert Remote 服务。

当前尚未发布到 npm。安装最新源码修复时，在项目目录构建并安装到实际使用的 profile：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
npm ci --ignore-scripts
npm run check
npm pack
dsh plugin --profile web add .\michengai-dsh-pua-0.3.8.tgz --ignore-scripts
```

这里的 `michengai-dsh-pua-0.3.8.tgz` 由上一行 `npm pack` 生成，也可直接使用同名本地交付包。此前的包不包含本轮 Web 配置与会话覆盖实现，不能作为 0.3.0 的验证证据。

等待当前任务结束后重载 DSH 后端。浏览器刷新不一定重载插件；用 `/pua help` 确认能看到 P9、Loop 等入口。同版本重新打包时使用新文件名，避免包管理器复用旧内容。

## 设置页面

在「设置 → 插件 → 插件配置 → PUA 配置」修改并保存当前 profile 的全局默认。控件使用宿主公共 Button、Menu、Switch 和箭头图标，标签与下拉/开关同排，卡片外壳按官方 PluginCard 的布局与主题变量实现。全局关闭时隐藏聊天 PUA 入口；全局开启时，聊天输入栏权限右侧提供仅显示 PUA 的短入口，当前会话关闭时以斜线划掉文字，排在专家插件前，可查看当前生效值、逐项自定义或恢复继承。全局入口是首个 TAB 中可展开的卡片，不新增 TAB。会话参数直接编辑即覆盖，未修改项自动继承；仅已修改项显示“已自定义”和“恢复默认”，底部可全部恢复。组件交互已离线验证，真实 DSH 桌面联动仍待验收。

**0.3.0 行为变化：** 命令与聊天面板只修改当前会话，不再写入全局。已有 profile 设置保留；会话未覆盖的参数从下一模型步骤起跟随全局变化，显式选择与全局相同的值也算覆盖。`/pua reset [参数名]` 可恢复单项或全部继承。普通分叉不继承父会话命令或循环，使用全局默认。没有 settings 时降级为当前会话，默认关闭。

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `enabled` | 开启 | PUA 总开关；关闭取消当前 Loop，普通角色选择保留 |
| `flavor` | auto | 自动选味或锁定 15 种风味之一 |
| `mode` | pua | 普通、P7/P9/P10、Pro、Yes、Mama、Shot、英文或日文 |
| `subagents` | 关闭 | 是否对子代理启用；父会话关闭时子代理不能强制开启 |
| `terminalReview` | 开启 | 终端异常文本核验提醒 |
| `failureCandidates` | 开启 | 已确认失败的升级候选提示 |
| `qualityTriggers` | 开启 | 用户质量纠偏提示 |
| `offline` | false | true 关闭反馈提醒 |
| `feedbackFrequency` | 5 | 反馈提醒频率，0 关闭 |
| `maxIterations` | 0 | Loop 默认轮次上限，0 不限 |
| `verify` | 空 | 默认验收命令，空为模型报告 |
| `verificationTimeout` | 120 秒 | 独立验收超时，1–3600 秒 |

对子代理启用默认关闭，避免覆盖专家插件的专业角色约束。开启后继承父会话生效配置，不继承 Loop 实例、命令 ID 或失败计数；父会话不可用时保持关闭。开启不保证两套提示词没有语义冲突，仍需真实专家任务验收。

会话面板内的 Loop 表单必须显式点击启动。表单参数只用于本次启动，不修改默认配置；已启动 Loop 保持启动时的参数快照。

离线模式关闭自愿反馈提醒；任何设置下都没有联网刷新或上报能力。反馈默认每 5 次有可见 PUA 输出的交付提醒一次，0 关闭，提醒不会唤醒模型或记录评分。

## 命令

| 输入 | 行为 |
| --- | --- |
| `/pua [任务描述]` | 开启完整核心；明确任务排到后续轮次，无描述则继续当前任务 |
| `/pua on`、`/pua off` | 开关；off 同时取消本会话循环及其独立验收 |
| `/pua config {"subagents":true}` | 只修改当前会话参数，不写全局 |
| `/pua reset [参数名]` | 恢复单项或全部跟随全局 |
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

Loop 必须显式启动，省略参数使用当前会话生效默认值。出厂默认不限轮次、无验收命令（honor system），不能声称独立验收通过。Windows Oracle 使用 PowerShell，在会话工作目录执行，默认超时 120 秒，可配置为 1–3600 秒，stdout/stderr 各最多保留 8 KiB。命令通过不代表测试文件不可能被修改；这不是操作系统级隔离沙箱。

启动任务中的 `PUA_LOOP_START` 包含完整 `--verify` 命令，对模型可见。命令 ID 校验用于阻止旧排队请求恢复旧配置；验证命令不由模型输出改写，但验证文件和执行环境没有不可篡改保证。

模型输出 `<promise>LOOP_DONE</promise>` 后触发 Oracle；失败继续，连续 3/5 次拒绝触发反思。`<loop-pause>需要什么</loop-pause>` 暂停，用户在同会话补充后恢复；`<loop-abort>原因</loop-abort>` 中止。用户取消、异常结束、卸载均取消续轮，恢复会话不会自行唤醒模型。

会话命令与运行记录保存在宿主日志，不新增未知必需事件。失败观察保存计数和最近 128 个调用 ID 哈希；Loop 保存任务、用户验证配置、迭代与独立验证摘要。压缩后恢复数字观察，不将其当作任务失败或验收结论。clear 清除运行观察。

源码审查修复使用宿主 `surface replace` 将每条 `PUA_RUNTIME_V1` 替换为简短运行说明：完整 JSON 留在日志供恢复，后续模型请求不重复接收它。旧会话中仍可见的原始记录在下一次模型步骤前替换；过去已经发出的请求保持原样，卸载后宿主仍能按日志重建替换结果。命令状态只消费新增事件，设置变化仍会刷新默认值。

终端失败通知早于宿主工具结果落库，因此只更新内存观察。整组工具结果落库后才保存记录，下一步至多注入该组最新一级候选；off、取消和卸载也遵守这一写入边界。进程在安全写入前退出可能丢失尚未持久化的观察，不补造工具结果。

DSH 0.1.5 的默认持久终端返回纯文本，退出或超时标记也可能由命令自行打印。插件在整组结果完整后的下一步骤合并发送一次“终端状态待核验”提示，不把这些文本累计为确认失败，不自动触发 L1–L4 升级。结构化退出码或工具执行错误仍沿用既有观察逻辑；显式 Loop 的独立 Oracle 不受此降级影响。

会话上下文替换适配 V2 的 `start/end` 和 V3 的 `startSeq/endSeq`。旧日志迁移由官方宿主负责；本插件不会自行改写历史文件。

旧版形成的“工具调用 → PUA 消息 → 工具结果”会在下一次模型步骤前兼容处理：仅针对结果齐全、间隔消息全部来自本插件运行时的工具组，用宿主上下文替换保留原结果身份和内容，省去打断顺序的 PUA 节点。原始日志不改写，不重新执行工具。升级并重载后可在原会话继续；真正缺失结果或其他来源插入消息不在自动修复范围。详见[工具消息顺序修复](docs/07-迭代归档/2026/I003-完整原版移植/03-工具消息顺序修复.md)。

off 后后续步骤收到停用说明；已发出的普通模型请求和工具调用不撤回，已排队用户任务仍正常处理。卸载保留宿主历史与业务文件。用 complete system prompt 压制普通 section 的 Agent 不在当前支持范围内。

## 验证与开发结构

测试覆盖真实 DSH 命令、settings、资料工具、AgentLoop、原文保真、状态恢复、循环控制和真实 Git/PowerShell。固定回复适配器只证明请求及控制链正确，不证明真实模型遵循程度或任务效率。

执行 `npm run check` 验证当前开发宿主；构建后执行 `npm run test:compat` 在隔离依赖树中验证全部声明版本，也可传入 `-- 0.1.5-rc.2`。新版持久终端测试运行官方工具包装，使用内存 PTY 夹具；迁移测试运行官方 V2→V3 逻辑事件迁移阶段，均不读写用户会话。

| 路径 | 用途 |
| --- | --- |
| `src/content.ts`、`src/source.ts` | 原文校验、完整拼装、资料白名单 |
| `src/command.ts`、`src/args.ts`、`src/state.ts` | 命令与会话状态 |
| `src/runtime.ts`、`src/hook-content.ts`、`src/tool-order.ts` | hook 模板、观察、Loop、工具组写入边界与历史兼容 |
| `src/session-compat.ts`、`src/terminal-observation.ts` | V2/V3 替换范围与持久终端文本核验线索 |
| `src/settings.ts` | DSH 设置 schema 和持久默认 |
| `src/configuration.ts`、`src/remote-contract.ts`、`src/remote.ts`、`src/client.ts` | 共享配置校验、原生 Remote、插件设置页与会话面板 |
| `src/review.ts` | 有界只读 Git 索引证据 |
| `assets/pua/upstream` | 85 个原版文件，旧 19 份素材保留兼容 |
| `scripts/verify.mjs`、`scripts/smoke-package.mjs`、`scripts/check-compat.mjs` | 素材、文档、依赖一致性、安装校验与版本矩阵 |

## 卸载与回退

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web remove @michengai/dsh-pua
```

卸载后等待当前任务结束再重载后端，保留业务文件和会话日志。rc.2 环境可用保留的 `michengai-dsh-pua-0.2.1.tgz` 回退代码；新会话覆盖不会被旧版识别，旧命令恢复为可修改全局的语义。回退代码不撤销已保存的全局配置，需要先在新配置页调整。若需回到插件 `0.2.0`，仅可在 DSH `0.1.2-rc.1` 的独立环境中使用此前保留工具顺序修复的包：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web add .\michengai-dsh-pua-0.2.0-tool-order-fix.tgz --ignore-scripts
```

不要将 `0.2.0` 安装到 rc.2 环境，也不要让旧宿主读取已迁移的 V3 日志；恢复旧宿主需要匹配版本的独立环境及迁移前数据。更早的 `0.2.0-review-fix`、`0.2.0-local` 仍有工具消息顺序缺陷。代码回退不会撤销已追加的上下文替换事件，原始工具证据始终保留。

## 来源与许可

实现采用 MIT。原版来自 [tanweai/pua](https://github.com/tanweai/pua)，固定为 3.5.1。署名及许可边界见 [NOTICE](NOTICE)，指纹见[素材清单](assets/pua/upstream.json)。本项目不是 PUA 或 DeepSeek 官方插件。
