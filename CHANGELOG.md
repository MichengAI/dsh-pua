# 更新记录

## 0.3.11

### 中文

- 为 PUA 会话入口和运行状态卡片添加统一的仪表盘图标，便于与相邻的专家入口区分。

### English

- Add a consistent gauge icon to the PUA session entry and running status card to distinguish them from the adjacent Experts entry.

## 0.3.10

### 中文

- 新增仅在任务运行或验收期间显示的 PUA 状态卡片，可查看角色、风味、子代理策略和 Loop 进度；状态名称与值逐行对齐，支持展开详情和取消 Loop。
- 优化全局与会话配置的字段间距、分隔线和覆盖操作位置，全局设置使用统一的保存与放弃修改操作。
- 修复启动 Loop 成功后配置窗口仍保持打开的问题，启动失败时保留输入，方便重试。

### English

- Add a PUA status card shown only while tasks or verification are running, with role, style, subagent policy, and Loop progress. Labels and values align by row, with expandable details and Loop cancellation.
- Improve spacing, separators, and override controls in global and session settings, with consistent Save and Discard actions for global settings.
- Close the configuration dialog after a successful Loop start while preserving input on failure for retry.

## 0.3.9

### 中文

- 新增完整英文首页与中文切换，两种语言使用各自的品牌横幅，并补齐安装说明与配置截图。
- 精简使用说明和项目徽章，默认通过 npm 安装；GitHub Release 仅提供版本说明。

### English

- Add a complete English homepage with a Chinese language switch, language-specific banners, clear installation steps, and configuration screenshots.
- Simplify usage guidance and project badges, with npm as the default installation method and release notes only on GitHub Releases.

## 0.3.8

### 中文

- 首次公开发布：将 PUA 3.5.1 的任务推进、角色风味和证据检查带到 DSH，支持显式验收 Loop。
- 在插件设置中保存全局默认，通过专家右侧的 PUA 入口调整当前会话；修复全局保存错误、会话输入校验和审批拒绝误计失败。全局默认开启，聊天操作只覆盖当前会话，子代理默认关闭。
- 支持 DSH 0.1.2-rc.1、0.1.5-rc.1 和 0.1.5-rc.2。原创代码采用 Apache-2.0，上游 PUA 素材保留 MIT 声明与署名。真实模型效果因任务和模型而异。

### English

- First public release: bring PUA 3.5.1 task persistence, personas, styles, and evidence checks to DSH, with explicit verification loops.
- Save global defaults in plugin settings and adjust individual sessions through the PUA entry to the right of Experts. Fix global saves, session input validation, and approval denials being counted as failures. PUA is enabled globally by default; chat changes affect only the current session, and subagents are disabled by default.
- Support DSH 0.1.2-rc.1, 0.1.5-rc.1, and 0.1.5-rc.2. Original code uses Apache-2.0; upstream PUA assets retain their declared MIT license and attribution. Actual results vary by task and model.

## 0.3.7（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- 修复未完成工具调用长期阻塞 PUA 状态同步，以及无 settings 宿主的会话配置降级问题。
- 修复 Loop 表单长度限制冲突、同值命令误报配置冲突、子会话保存反馈和输入校验；保留 Oracle 的真实非零退出码。
- 终端成功会清除连续失败观察，每轮候选提示最多四次，权限边界不计入升级；全局开关和会话覆盖规则不变。

### English

- Fix unfinished tool calls blocking PUA state persistence and restore session-only fallback on hosts without settings.
- Fix Loop form limits, false configuration conflicts from unchanged commands, child-session save feedback, and input validation; preserve native Oracle exit codes.
- Successful terminal results reset consecutive failure observations; candidate prompts are capped at four per turn and permission errors are excluded. Global and session override rules remain unchanged.


## 0.3.6（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- 加快新会话 PUA 入口显示：全局开启后先显示入口，会话配置就绪后即可操作；初始化失败时快速重试。

### English

- Show the PUA entry as soon as global enablement is confirmed, enable it when session configuration is ready, and retry initialization failures sooner.

## 0.3.5（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- 修复配置下拉菜单向右溢出：菜单右边缘对齐按钮，向左展开。

### English

- Fix configuration dropdowns overflowing to the right by aligning menus with the right edge of their triggers.

## 0.3.4（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- 下拉触发及表单操作改用宿主 Button，标签与下拉控件同排，不再使用另起一行的矩形按钮。
- CHAT 入口仅显示 PUA，当前会话关闭时加斜线；全局关闭仍隐藏入口。

### English

- Dropdown triggers and form actions now use the host Button component, with labels and dropdowns on the same row.
- The chat entry displays only PUA, crossed diagonally when the session is disabled; global disablement still hides the entry.

## 0.3.3（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- 全局关闭 PUA 时隐藏聊天入口，重新开启后恢复；仅关闭当前会话时仍保留入口。

### English

- Hide the chat entry when PUA is globally disabled and restore it when re-enabled. Disabling only the current session keeps the entry available.

## 0.3.2（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- 设置中的菜单、开关和图标改用宿主公共控件，卡片对齐官方插件配置的布局与主题样式。
- 聊天 PUA 入口仅显示开启或关闭，风味与自定义状态仍可在面板查看。

### English

- Settings now use shared host menus, switches, and icons; the card follows the official plugin configuration layout and theme tokens.
- The chat PUA entry shows only enabled or disabled status; flavor and overrides remain available in the panel.

## 0.3.1（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- PUA 全局配置移入官方“插件配置”首个 TAB 的可展开卡片，不再新增独立 TAB。
- 会话参数可直接修改，自动形成覆盖；移除配置来源下拉框和重复生效值，仅自定义项提供恢复默认。

### English

- Moved global PUA settings into an expandable card in the official first Plugin configuration tab, removing the separate tab.
- Session fields can be edited directly to create overrides. Removed source selectors and duplicate effective values; customized fields offer a reset action.

## 0.3.0（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- 新增「设置 → 插件 → PUA 配置」和聊天栏 PUA 入口，支持全局默认、逐项会话覆盖与恢复继承；Loop 表单可单独指定本次验收参数。
- **行为变化：** 命令仅修改当前会话，不再写全局；未覆盖项动态跟随全局，旧 profile 设置保留。Loop 省略参数时使用会话生效默认值，启动后保持快照。
- 新增对子代理启用开关，默认关闭；开启后继承父会话生效配置，父会话关闭时不能强制开启，不继承父 Loop 或失败计数。

### English

- Added PUA configuration under Settings → Plugins and a chat toolbar entry, with global defaults, per-field session overrides, inheritance reset, and per-run Loop verification parameters.
- **Behavior change:** commands now update only the current session, never global defaults. Unmodified fields follow global changes, existing profile settings are retained, and omitted Loop arguments use effective session defaults frozen at startup.
- Added an opt-in subagent switch, disabled by default. Enabled subagents inherit effective parent configuration, cannot override a disabled parent, and do not inherit its Loop or failure count.

## 0.2.1（本地版本，未公开发布 / Local build, not publicly released）

### 中文

- 新增 DSH `0.1.5-rc.1`、`0.1.5-rc.2` 支持，保留 `0.1.2-rc.1`，适配 V3 会话上下文与旧历史修复。旧插件包不支持新版宿主；已迁移的 V3 日志不能直接交给旧宿主回退读取。
- 新版持久终端的疑似退出或超时文本触发一次待核验提示，不累计为确认失败或自动升级压力；显式 Loop 仍使用独立验收。
- 修复工具调用与结果被 PUA 消息打断的问题，兼容结果齐全的受影响历史；运行状态 JSON 在模型上下文中显示为简短说明，并修正 Windows 验收命令的引号传递。

### English

- Added support for DSH `0.1.5-rc.1` and `0.1.5-rc.2`, retaining `0.1.2-rc.1`, with V3 session context support and legacy history repair. Older plugin packages do not support the newer hosts; migrated V3 logs cannot be read directly by an older host after a downgrade.
- Suspected exit or timeout text from persistent terminals now prompts verification once, without counting confirmed failures or automatically escalating pressure. Explicit Loops continue to use independent verification.
- Fixed PUA messages interrupting tool calls and results, with compatibility repair for affected history containing all results. Runtime JSON appears as a brief note in model context, and Windows verification commands preserve quotation marks.

## 0.2.0

**升级行为变化：** 相比 0.1.1 默认关闭，宿主提供 settings 时默认开启并使用 auto 选味；已有显式会话配置仍优先。没有 settings 时仍默认关闭。

- 用 PUA 3.5.1 完整核心替换自写摘要，恢复人格、旁白、Banner、诊断、认知换框及 Owner 协议。
- 收录 85 个固定 Git 提交的原始文件，提供完整资料工具；新增角色模式和自动选味。
- 接入标准 DSH 设置页，支持默认开启、锁定风味、离线与反馈频率，保留会话显式配置优先。
- 移植终端失败候选和用户质量纠偏，保留条件门控，排除取消、拒绝和文本伪退出码。
- 实现显式 Loop、独立 PowerShell 验收、拒绝重试、上限、暂停、取消和卸载回收。
- 保留原版本地问卷和 Pro 协议，明确团队资源、权限策略及恢复方式的平台差异。

## 0.1.1

- 修复 `/pua in` 等疑似拼错和未实现子命令被当作任务，兼容单层重复命令前缀。
- 引入原版 Again、Done Check、Evidence 输出模板，补齐开工与交付旁白、纯分析诊断及证据门槛。
- 新增 `/pua review [范围]` 和精确中文审查入口，利用可选宿主 subprocess 采集只读 Git 索引事实。
- 区分已确认发现和待验证疑点，防止把本地目录误判为提交记录；预检取消、卸载及并发关闭保持正确状态。
- 保留 0.1.0 成功命令的历史含义；素材增加固定 Git 提交对象指纹。

## 0.1.0

- 初始化 DSH 原生 PUA 插件，提供 `/pua` 及当前任务控制、换方法和验收命令。
- 加入 15 种风味、按风味注入方法论和固定来源素材校验。
- 根据当前会话成功命令恢复配置，隔离分叉、失败命令和未完成命令。
- 提供严格 TypeScript 构建、宿主测试、本地打包和开发文档。

当前为本地开发版本，尚未公开发布。
