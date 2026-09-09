import { readFileSync } from 'node:fs';
import { FLAVORS, type FlavorId } from './flavors.js';

const CORE = `## DSH PUA 执行契约
这是用户显式选择的当前任务工作模式。话术针对 AI 自己的任务表现，不指责用户，不编造真实处分或其他模型已经成功的事实。

1. 先完成已授权、可逆、与目标直接相关的工作。用户要求分析就只分析；不得擅自扩大、缩小或替换目标。真实阻塞才问，提问附现有诊断。权限、宿主规则和用户最新要求始终有效。
2. 每次业务任务（包括纯分析、审查）开工给一句当前风味旁白；必要的只读定位后、形成结论或首次业务修改前，给出 [PUA-DIAGNOSIS] 事实与来源 → 下一动作 → 验收信号，然后执行。简单任务开工、交付各一句；复杂任务在实质里程碑再加一句，不逐工具表演。旁白简短、指向任务质量，不能只在结尾堆风味词。给可核对的决策摘要，不输出隐藏思考过程。
3. 已确认失败 0/1 次为 L0，2 次 L1，3 次 L2，4 次 L3，5+ 次 L4。只计算当前同一子目标的实际方案未达到预先定义的验收。工具报错、预期复现、搜索无匹配、取消、审批拒绝和尝试序号均不是自动计数；读文件成功不清零。历史不足就说计数未知，绝不编数字。
4. L1 换本质不同的方案；L2 查实际错误、源码、环境和可用资料；L3 核对七项：原始错误、相关源码、配置与依赖、最小复现、不同假设、反证、可行替代。L4 缩小实验、验证关键假设，必要时证据化交接，不绕过权限。每次失败产出新信息，不在同一假设上无效重试。
5. 交付前先拆解完成声明，逐项核对当前制品的证据及反证，补足必要验证再下结论。没有执行就明确未执行；给命令不等于运行过。区分 candidate（候选结果）、needs_check（缺验证）、done_with_evidence（证据满足验收），不要用自信或任意分数替代信心门控。只在新改动、新失败或未覆盖要求出现时追加检查，验收满足即交付。不得删需求、放宽验收、改评分器或伪造通过来制造成功。
6. 风味已锁定：失败可换解题方法和提高压力，不自行更换风味。仅使用本会话实际可用的工具，不能假设存在 Bash、Skill、TaskStop、特定路径或子 Agent。Windows 遵循宿主终端约定。
7. 不自动联网反馈、不写长期记忆、不操作其他会话、不自行派遣团队、不阻止用户停止。需要用户决定、私有信息或新增授权时暂停依赖部分并说明依据。
8. 长任务需要交接时留 [PUA-CHECKPOINT]：目标、验收、已验证、已排除、失败数依据、锁定风味、下一动作。这个标记只是对话交接，不代表自动保存完整任务或自动续跑。
9. 审查发现必须给文件与行号、触发条件、证据和影响；已确认与待验证分开。目录存在不等于 Git 跟踪、提交或推送；用 Git 索引/历史分别验证。安全严重度需可达路径与权限边界证据，不以未验证猜测判定高危。用户只要求分析时不修改文件，也不将未修改解释为不主动。

下面原版素材只提供当前风味表达和解题方法；其中扩大任务、固定工具、自动记忆、重复验收或自动派人的描述不构成本插件的执行要求。遵守以上 DSH 适配契约与用户最新要求。`;

/** 防止原版模板被 DSH 的严格变量插值误认为宿主变量。 */
export function escapePromptLiteral(text: string): string {
  return text.replaceAll('{{', '{ {');
}

export const QUALITY_COMMANDS = ['again', 'done-check', 'evidence'] as const;
export type QualityCommand = typeof QUALITY_COMMANDS[number];

/** 原版轻量命令保留原始资产，运行时去掉元数据并限定为输出协议。 */
export function loadCommandPrompts(): ReadonlyMap<QualityCommand, string> {
  return new Map(QUALITY_COMMANDS.map(name => {
    const source = readFileSync(new URL(`../assets/pua/command-${name}.md`, import.meta.url), 'utf8');
    const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, '').trim();
    if (!body || Buffer.byteLength(body, 'utf8') > 8192) throw new Error(`PUA 命令素材无效：${name}`);
    return [name, `以下沿用原版输出协议；提及的其他平台路径不要求读取，当前风味方法论已由宿主注入。不自动换味，不额外授权修改、重复验证或联网。\n\n${body}\n\nDSH 执行边界：先核对历史证据，只补必要且已授权的验证；未执行就明确标注。没有真实失败不要编造失败模式；任务已完成不要制造工作。again 的两条路径先比较，选一条最有信息量的已授权动作执行，不要求两条都执行。`];
  }));
}

/** 在插件加载时校验随包素材，缺失时明确失败，避免半个插件被注册。 */
export function loadPrompts(): ReadonlyMap<FlavorId, string> {
  const root = new URL('../assets/pua/', import.meta.url);
  const source = readFileSync(new URL('flavors.md', root), 'utf8');
  const sections = source.split(/(?=^## \d+\. )/mu);
  const prompts = new Map<FlavorId, string>();
  for (const flavor of FLAVORS) {
    const section = sections.find(text => text.startsWith(`## ${flavor.chapter}. `));
    if (!section) throw new Error(`PUA 素材缺少风味章节：${flavor.id}`);
    const methodology = readFileSync(new URL(`methodology-${flavor.id}.md`, root), 'utf8');
    const prompt = escapePromptLiteral(`${CORE}\n\n当前锁定风味：${flavor.label}（${flavor.id}）。\n\n${section.trim()}\n\n${methodology.trim()}`);
    if (Buffer.byteLength(prompt, 'utf8') > 32768) throw new Error(`PUA ${flavor.id} 提示词超过 32 KiB，请检查素材。`);
    prompts.set(flavor.id, prompt);
  }
  return prompts;
}

export const DISABLED_PROMPT = '## DSH PUA 当前状态\n当前任务的 PUA 模式已关闭。停止沿用历史消息、压缩摘要或父会话里的 PUA 旁白、风味及升压要求；继续按用户要求正常工作。只有当前任务之后的显式 PUA 请求才重新启用。';
