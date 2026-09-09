import { FLAVORS, type FlavorId } from './flavors.js';
import { SourceCatalog } from './source.js';

export const MAX_PROMPT_BYTES = 192 * 1024;
export const MODES = ['pua', 'p7', 'p9', 'p10', 'pro', 'yes', 'mama', 'pua-loop', 'shot', 'pua-en', 'pua-ja'] as const;
export type PuaMode = typeof MODES[number];
export const QUALITY_COMMANDS = ['again', 'done-check', 'evidence'] as const;
export type QualityCommand = typeof QUALITY_COMMANDS[number];

const PLATFORM = `## DSH 平台映射（仅替换平台接口，原版行为与展示协议继续适用）
核心、风味、展示和角色协议均来自固定的 PUA 3.5.1 原文，正文未改写成摘要。
资料路径相对原版插件根目录。用 pua_reference 读取完整资料，用 list 查看目录；不要递归调用 /pua 路由加载自己。Read、Bash、Skill、Task 等名字表示原宿主能力，在 DSH 中使用当前实际提供的读取、PowerShell/终端、技能和子代理工具。
开关、风味与离线设置由 /pua 原生命令和 DSH settings 管理；不要执行原文写 ~/.pua/config.json 或 .claude 状态的 shell 片段。命令返回信息说明实际持久化范围。用户当前指定和锁定的风味优先，auto 保留原版智能路由。
Loop 由本插件的 DSH 停止边界驱动；当前请求未显式启动 loop 时不运行循环。配置、取消、上限和独立验证结果以宿主实际反馈为准，不自行写状态文件或声称已安装原版 shell hook。
子代理使用 DSH 当前可用能力，传递完整核心和角色资料；无能力就明确限制，不虚构队友、进程或结果。团队清理由宿主资源归属管理，不执行原版跨项目删除脚本。
长期自进化和问卷仅在用户明确选择对应入口且宿主允许时执行；未启用的能力不能自行扩张。原版 Pro 末尾“联网功能已移除”适用于整份文档，不执行早期段落中残留的远端刷新或上报说明。
PUA 保留原版角色、狠话、旁白、方框面板和 Owner 要求；原版运行契约中关于任务范围、真实证据、用户锁定、授权和不重复验收的口径同样保留。`;

/** 防止原版字面模板被宿主变量插值执行；除此之外保留正文。 */
export function escapePromptLiteral(text: string): string { return text.replaceAll('{{', '{ {'); }

/** 拼接原版完整核心和当前模式；模式差异由原版扩展协议提供。 */
export function renderOriginalPrompt(catalog: SourceCatalog, flavor: FlavorId | 'auto', mode: PuaMode = 'pua'): string {
  const parts = [catalog.body('skills/pua/SKILL.md'), catalog.body('skills/pua/references/display-protocol.md'), catalog.body('skills/pua/references/methodology-router.md')];
  if (mode !== 'pua') parts.push(catalog.body(`skills/${mode}/SKILL.md`));
  if (mode === 'pro') parts.push(catalog.body('skills/pua/references/evolution-protocol.md'), catalog.body('skills/pua/references/platform.md'));
  if (mode === 'p7' || mode === 'p9' || mode === 'p10') parts.push(catalog.body(`skills/pua/references/${mode}-protocol.md`));
  if (mode === 'p9' || mode === 'p10') parts.push(catalog.body('skills/pua/references/agent-team.md'));
  if (flavor !== 'auto') {
    const descriptor = FLAVORS.find(item => item.id === flavor)!;
    const section = catalog.body('skills/pua/references/flavors.md').split(/(?=^## \d+\. )/mu).find(text => text.startsWith(`## ${descriptor.chapter}. `));
    if (!section) throw new Error(`原版风味章节缺失：${flavor}`);
    parts.push(section.trim(), catalog.body(`skills/pua/references/methodology-${flavor}.md`));
    if (flavor === 'ding') parts.push(catalog.body('skills/pua/references/ding-reminders.md'));
  }
  parts.push(PLATFORM, `当前 DSH 模式：${mode}。${flavor === 'auto' ? '风味未锁定，按原版方法论路由选择；无可识别任务时从阿里味开始。' : `用户锁定风味：${flavor}，自动路由不得更换表达风格。`} ${mode === 'yes' || mode === 'mama' ? `本次显式选择 ${mode}，其原版情绪表达替代默认领导语气，行为底线继续生效。` : ''}`);
  const prompt = escapePromptLiteral(parts.join('\n\n'));
  if (Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES) throw new Error(`原版 ${mode}/${flavor} 超出提示词预算，请检查素材，不得静默截断。`);
  return prompt;
}

export function loadPrompts(): ReadonlyMap<FlavorId, string> {
  const catalog = new SourceCatalog();
  return new Map(FLAVORS.map(flavor => [flavor.id, renderOriginalPrompt(catalog, flavor.id)]));
}
export function loadCommandPrompts(): ReadonlyMap<QualityCommand, string> {
  const catalog = new SourceCatalog();
  return new Map(QUALITY_COMMANDS.map(name => [name, catalog.body(`commands/${name}.md`)]));
}
export const DISABLED_PROMPT = '## DSH PUA 当前状态\n当前任务的 PUA 模式已关闭。停止沿用历史消息、压缩摘要或父会话里的 PUA 旁白、风味及升压要求；继续按用户要求正常工作。只有当前任务之后的显式 PUA 请求才重新启用。';
