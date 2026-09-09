import { SourceCatalog } from './source.js';
import type { PuaState } from './state.js';

/** 只解析固定版本的模板，不执行上游 shell 或任意变量表达式。 */
export class HookContent {
  private readonly failure: string;
  private readonly flavors: string;
  private readonly frustration: string;
  readonly trigger: RegExp;
  constructor(catalog: SourceCatalog) {
    this.failure = catalog.read('hooks/failure-detector.sh');
    this.flavors = catalog.read('hooks/flavor-helper.sh');
    this.frustration = catalog.read('hooks/frustration-trigger.sh');
    const expression = /^TRIGGER_RE='(.*)'$/mu.exec(this.frustration)?.[1];
    if (!expression) throw new Error('原版质量纠偏触发规则缺失。');
    this.trigger = new RegExp(expression.replaceAll('[:alnum:]', 'A-Za-z0-9'), 'iu');
  }
  private variables(state: PuaState): Record<string, string> {
    const name = state.flavor === 'tesla' ? 'musk' : state.flavor === 'apple' ? 'jobs' : state.flavor;
    const block = new RegExp(`^    ${name}\\)\\n([\\s\\S]*?)^      ;;`, 'mu').exec(this.flavors)?.[1];
    if (!block) throw new Error(`缺少原版 hook 风味：${name}`);
    return { PUA_FLAVOR: name, ...Object.fromEntries([...block.matchAll(/^\s+(PUA_[A-Z0-9_]+)="(.*)"$/gmu)].map(match => [match[1]!, match[2]!])) };
  }
  private interpolate(text: string, variables: Record<string, string>): string {
    return text.replace(/\$\{([A-Z0-9_]+)\}/gu, (_, key: string) => {
      if (!(key in variables)) throw new Error(`原版 hook 变量未适配：${key}`);
      return variables[key]!;
    });
  }
  frustrationPrompt(state: PuaState): string {
    const body = /cat << EOF\n([\s\S]*?)\nEOF/mu.exec(this.frustration)?.[1];
    if (!body) throw new Error('原版质量纠偏模板缺失。');
    return this.interpolate(body, this.variables(state));
  }
  candidate(count: number, state: PuaState): string {
    // 原版 failure-detector.sh 首次确认失败保持不打断，从第二次观察才提供 L1 候选。
    const level = Math.min(4, count - 1);
    if (level < 1) return '';
    const blocks = [...this.failure.matchAll(/<< EOF_OUTPUT\n([\s\S]*?)\nEOF_OUTPUT/gu)];
    const gate = /<< EOF_GATE[^\n]*\n([\s\S]*?)\nEOF_GATE/u.exec(this.failure)?.[1];
    const routing = [...this.failure.matchAll(/<< EOF_ROUTING[^\n]*\n([\s\S]*?)\nEOF_ROUTING/gu)];
    const flavorContext = [...this.failure.matchAll(/^\s*FLAVOR_CONTEXT="(.*)"$/gmu)];
    // 索引顺序来自固定版本：locked L2/L4、auto L2/L4；升级素材须显式适配。
    if (!gate || blocks.length !== 4 || routing.length !== 4 || flavorContext.length !== 2) {
      throw new Error(`原版失败候选模板结构不匹配：gate=${Boolean(gate)}，output=${blocks.length}/4，routing=${routing.length}/4，flavor=${flavorContext.length}/2。`);
    }
    const variables = { ...this.variables(state), COUNT: String(count), CANDIDATE_LEVEL: `L${level}`, CANDIDATE_THRESHOLD: count >= 5 ? '5+' : String(count) };
    const expanded: Record<string, string> = {
      ...variables,
      CONDITIONAL_GATE: this.interpolate(gate, variables),
      OBSERVATION_NOTE: `Scoped tool-failure observation count: ${count}. It is not a task/sub-goal failure count or an acceptance conclusion.`,
      SKILL_READ_NOTE: '需要细节时用 pua_reference 读取 skills/pua/SKILL.md；不递归激活技能。',
      FLAVOR_CONTEXT: this.interpolate(flavorContext[state.flavorLocked ? 0 : 1]![1]!, variables),
      L2_ROUTING_BLOCK: this.interpolate(routing[state.flavorLocked ? 0 : 2]![1]!, variables),
      L4_ROUTING_BLOCK: this.interpolate(routing[state.flavorLocked ? 1 : 3]![1]!, variables),
    };
    return this.interpolate(blocks[level - 1]![1]!, expanded);
  }
}
