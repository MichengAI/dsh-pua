import { FLAVORS, type FlavorId } from './flavors.js';
import { SourceCatalog } from './source.js';
import { serverCopy } from './server-copy.js';

export const MAX_PROMPT_BYTES = 192 * 1024;
export const MODES = ['pua', 'p7', 'p9', 'p10', 'pro', 'yes', 'mama', 'pua-loop', 'shot', 'pua-en', 'pua-ja'] as const;
export type PuaMode = typeof MODES[number];
export const QUALITY_COMMANDS = ['again', 'done-check', 'evidence'] as const;
export type QualityCommand = typeof QUALITY_COMMANDS[number];


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
    if (!section) throw new Error(serverCopy().prompt.flavorMissing(flavor));
    parts.push(section.trim(), catalog.body(`skills/pua/references/methodology-${flavor}.md`));
    if (flavor === 'ding') parts.push(catalog.body('skills/pua/references/ding-reminders.md'));
  }
  const copy = serverCopy();
  parts.push(copy.prompt.platform, `${copy.prompt.modeLine(mode, flavor === 'auto' ? copy.prompt.flavorAuto : copy.prompt.flavorLocked(flavor))} ${mode === 'yes' || mode === 'mama' ? copy.prompt.emotionalOverride(mode) : ''}`);
  const prompt = escapePromptLiteral(parts.join('\n\n'));
  if (Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES) throw new Error(serverCopy().prompt.budgetExceeded(mode, flavor));
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
/** 关闭说明；每次读取当前语言，语言切换后立即生效。 */
export function disabledPrompt(): string { return serverCopy().prompt.disabled; }
