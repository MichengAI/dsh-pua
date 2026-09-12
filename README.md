<div align="center">

# DSH PUA

**让 Agent 少一点敷衍，多一点尝试和验证**

[功能概览](#功能概览) · [界面预览](#界面预览) · [安装](#安装) · [使用](#使用) · [配置](#配置) · [常用命令](#常用命令) · [更新日志](CHANGELOG.md) · [Apache-2.0](LICENSE)

[![许可证：Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![DSH Web Plugin](https://img.shields.io/badge/DSH%20Web-Plugin-0f766e.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Node.js 22.19+](https://img.shields.io/badge/Node.js-22.19%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> DSH PUA 将 [原版 PUA](https://github.com/tanweai/pua) 带到 DeepSeek Harness，在 Agent 反复失败、过早放弃或草率宣告完成时，引导它换方法、查原因、拿证据。社区维护，非 DeepSeek AI 或 PUA 官方产品。

## 功能概览

- **遇到困难换方法**：提醒 Agent 重新检查思路，避免重复无效尝试。
- **完成前检查证据**：要求核对结果，减少“说完成了，却没有验证”的情况。
- **选择你喜欢的风格**：支持 15 种大厂风味，以及 P7、P9、P10、夸夸、妈妈等角色模式。
- **在界面中调整**：插件设置保存全局默认，聊天入口可以单独调整当前会话。
- **按验收结果继续任务**：可启动 Loop，让 Agent 继续修正，直到验收通过、达到轮次上限或被取消。

实际效果取决于所用模型和任务，插件不保证每次都能解决问题。

## 界面预览

### 全局配置

在「设置 → 插件 → PUA 配置」设置默认开关、风味、角色和子代理选项，保存后供会话使用。

![PUA 全局配置：开关、风味、角色模式和子代理选项](assets/screenshots/pua-global-settings.png)

### 当前会话配置

点击专家入口右侧的 **PUA**，单独调整当前会话。修改项可以恢复默认，也可以在面板中启动或取消 Loop。

![聊天中的 PUA 入口与当前会话配置面板](assets/screenshots/pua-session-settings.png)

## DSH 产品生态

以下是可配合使用的同系列项目，按实际需要选择：

| 项目 | 你可以用它做什么 |
| --- | --- |
| [Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop) | 使用集成 DSH Web 的桌面工作台 |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | 整理项目与会话、搜索任务、跳转对话轮次 |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | 从消息平台下任务、收回复 |
| [Automation](https://github.com/MichengAI/dsh-automation) | 按计划执行任务，查看每次运行的结果 |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | 查找、启停、创建和导入本机技能 |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | 搜索、恢复或清理已归档会话 |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | 按任务选择并召唤专业角色 |
| [BTW](https://github.com/MichengAI/dsh-btw) | 在当前上下文中临时旁问，不打断主任务 |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | 整理 Git 改动范围内的代码 |

## 安装

需要 Node.js 22.19 或更新版本，以及 DSH `0.1.2-rc.1`、`0.1.5-rc.1` 或 `0.1.5-rc.2`。使用 DSH 已有的模型配置，无需额外密钥。

以下示例使用 `web` profile，请替换为实际使用的 profile。

### 让 Agent 帮你安装

把下面这段话发给能够操作本机终端的 Agent：

```text
请将 @michengai/dsh-pua 安装到本机 web profile，执行 dsh plugin --profile web add @michengai/dsh-pua@latest --registry=https://registry.npmjs.org/。完成后检查插件是否加载，并告诉我如何打开 PUA 配置。
```

### 手动安装

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web add @michengai/dsh-pua@latest --registry=https://registry.npmjs.org/
```

等待当前任务结束后，重新加载 DSH 或重启 Web 服务；仅刷新浏览器不够。输入 `/pua help` 可检查插件是否可用。

## 使用

1. 打开「设置 → 插件」，在第一个「插件配置」页签中展开「PUA 配置」。
2. 开启 PUA，选择喜欢的风味和角色，保存设置。
3. 回到聊天，像平时一样提交任务。

聊天输入栏专家入口右侧会显示 **PUA**，点击即可查看或调整当前会话。当前会话关闭时，PUA 文字显示斜线；全局关闭时，聊天入口隐藏。

## 配置

**全局默认只在插件配置页修改。聊天面板和命令只影响当前会话。**

不修改就使用全局默认；修改某一项，只覆盖这一项。点击「恢复默认」即可重新跟随全局，也可以一次恢复全部。

| 可以调整什么 | 说明 |
| --- | --- |
| PUA 开关 | 默认开启，可单独关闭当前会话 |
| 风味与角色 | 自动选味或指定风味，选择不同角色模式 |
| 对子代理启用 | 默认关闭；需要让专家等子代理也使用 PUA 时再开启 |
| 纠偏提醒 | 调整终端核验、失败升级与质量提醒 |
| 反馈提醒 | 调整提醒频率，或关闭提醒；插件不上传反馈 |
| Loop 默认值 | 设置验收命令、超时时间和轮次上限 |

从 `0.3.0` 起，命令不再修改全局设置。子代理是否使用 PUA 还受父会话开关控制。

### 让任务按验收结果继续

在聊天 PUA 面板中填写 Loop 任务、验收命令和轮次上限，再点击启动。例如，让 Agent 修复测试，使用 `npm test` 检查结果，最多执行 10 轮。

也可以直接输入：

```text
/pua loop "修复当前测试失败并补齐回归" --verify "npm test" --max-iterations 10
```

需要停止时输入 `/cancel-pua-loop`。关闭当前会话 PUA 也会取消 Loop，但不会撤回已经执行的操作。

建议设置验收命令和轮次上限：未设置验收命令时，只依据模型报告判断完成；轮次上限为 0 表示不限轮次。

## 常用命令

日常开关、风味和角色都可以在界面操作，无需记住命令。

| 目标 | 命令示例 |
| --- | --- |
| 开启或关闭当前会话 PUA | `/pua on`、`/pua off` |
| 指定风味 | `/pua flavor huawei` |
| 让 Agent 换个方法 | `/pua again` |
| 检查是否真的完成 | `/pua done-check` |
| 检查交付证据 | `/pua evidence` |
| 只读审查当前改动 | `/pua review` |
| 恢复当前会话的全局默认 | `/pua reset` |
| 取消验收循环 | `/cancel-pua-loop` |
| 查看状态或完整用法 | `/pua status`、`/pua help` |

## 卸载

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
dsh plugin --profile web remove @michengai/dsh-pua
```

重新加载 DSH 后生效，业务文件和会话记录会保留。

## 来源与许可

基于 [tanweai/pua](https://github.com/tanweai/pua) 3.5.1 适配。角色和协作能力以 DSH 实际支持为准。

本项目原创代码采用 [Apache License 2.0](LICENSE)。随包提供的 PUA 素材保留上游声明的 MIT 许可及署名，详见 [NOTICE](NOTICE)。
