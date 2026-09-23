import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-system-prompt';
import { handleCommand } from './command.js';
import { DISABLED_PROMPT, renderOriginalPrompt, loadCommandPrompts } from './content.js';
import { StateStore } from './state.js';
import { SourceCatalog } from './source.js';
import { Config, PreferencesBridge } from './settings.js';
import { PuaRuntime } from './runtime.js';
import { Service } from '@deepseek-ai/cordis';

/** Web Remote 仅访问此插件提供的配置能力，不持有其他插件的运行状态。 */
export class PuaConfigurationService extends Service {
  constructor(ctx: Context, readonly store: StateStore, readonly preferences: PreferencesBridge, readonly runtime: PuaRuntime) { super(ctx, 'puaConfiguration'); }
}
declare module '@deepseek-ai/cordis' { interface Context { puaConfiguration: PuaConfigurationService } }

export const name = 'michengai-pua';
export const inject = ['commands', 'systemPrompt'];
export { Config };

/** 注册当前会话的 PUA 命令与动态行为契约；Cordis 自动随插件卸载撤销贡献。 */
export function apply(ctx: Context, config?: unknown): void {
  const catalog = new SourceCatalog();
  const prompts = new Map<string, string>();
  const templates = loadCommandPrompts();
  const preferences = new PreferencesBridge(ctx, config);
  const store = new StateStore(() => preferences.defaults(), session => {
    if ((session.header.delegationDepth ?? 0) === 0 || !session.header.parentSession) return undefined;
    return ctx.get('agents')?.get(session.header.parentSession)?.session;
  });
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort());
  const runtime = new PuaRuntime(ctx, store, catalog, lifetime.signal, () => preferences.feedback());
  new PuaConfigurationService(ctx, store, preferences, runtime);
  ctx.systemPrompt.section({
    name: 'michengai:pua',
    order: 120,
    text: ({ agent }) => {
      if (!agent) return '';
      const state = store.read(agent.session);
      if (state.enabled) {
        const flavor = state.flavorLocked ? state.flavor : 'auto';
        const mode = runtime.effectiveMode(agent.session, state.mode);
        const key = `${mode}/${flavor}`;
        if (!prompts.has(key)) prompts.set(key, renderOriginalPrompt(catalog, flavor, mode));
        return prompts.get(key)!;
      }
      if ((agent.session.header.delegationDepth ?? 0) > 0) return '';
      return state.configured || agent.session.header.parentSession !== undefined ? DISABLED_PROMPT : '';
    },
  });
  ctx.commands.register({
    name: 'pua',
    description: '开启 PUA 任务模式、切换风味、换方法或核查验收证据',
    input: { hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|任务描述]' },
    handler: invocation => handleCommand(store, { ...invocation, signal: AbortSignal.any([invocation.signal, lifetime.signal]) }, templates, ctx.get('subprocess'), { catalog, preferences, runtime, ctx }),
  });
  ctx.commands.register({
    name: 'pua-cancel-loop', description: '取消当前会话 PUA Loop，不中断普通模型任务',
    handler: invocation => {
      if (invocation.rawInput.trim()) return { kind: 'error', text: 'pua-cancel-loop 不接受额外参数。' };
      invocation.signal.throwIfAborted();
      runtime.cancel(invocation.agent.session);
      store.stage(invocation.agent.session, invocation.commandId, { kind: 'cancel-pua-loop' });
      return { kind: 'success', text: 'PUA · 当前 Loop 已取消。' };
    },
  });
}
