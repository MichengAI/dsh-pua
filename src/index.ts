import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-system-prompt';
import { handleCommand } from './command.js';
import { DISABLED_PROMPT, renderOriginalPrompt, loadCommandPrompts } from './content.js';
import { StateStore } from './state.js';
import { SourceCatalog } from './source.js';
import { PreferencesBridge } from './settings.js';
import { PuaRuntime } from './runtime.js';

export const name = 'michengai-pua';
export const inject = ['commands', 'systemPrompt'];

/** 注册当前会话的 PUA 命令与动态行为契约；Cordis 自动随插件卸载撤销贡献。 */
export function apply(ctx: Context): void {
  const catalog = new SourceCatalog();
  const prompts = new Map<string, string>();
  const templates = loadCommandPrompts();
  const preferences = new PreferencesBridge(ctx);
  const store = new StateStore(() => preferences.defaults());
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort());
  const runtime = new PuaRuntime(ctx, store, catalog, lifetime.signal, () => preferences.feedback());
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
    name: 'cancel-pua-loop', description: '取消当前会话 PUA Loop，不中断普通模型任务',
    handler: invocation => {
      if (invocation.rawInput.trim()) return { kind: 'error', text: 'cancel-pua-loop 不接受额外参数。' };
      invocation.signal.throwIfAborted();
      runtime.cancel(invocation.agent.session);
      store.stage(invocation.agent.session, invocation.commandId, { kind: 'cancel-pua-loop' });
      return { kind: 'success', text: 'PUA · 当前 Loop 已取消。' };
    },
  });
}
