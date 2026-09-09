import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-system-prompt';
import { handleCommand } from './command.js';
import { DISABLED_PROMPT, loadPrompts, loadCommandPrompts } from './content.js';
import { StateStore } from './state.js';

export const name = 'michengai-pua';
export const inject = ['commands', 'systemPrompt'];

/** 注册当前会话的 PUA 命令与动态行为契约；Cordis 自动随插件卸载撤销贡献。 */
export function apply(ctx: Context): void {
  const prompts = loadPrompts();
  const templates = loadCommandPrompts();
  const store = new StateStore();
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort());
  ctx.systemPrompt.section({
    name: 'michengai:pua',
    order: 120,
    text: ({ agent }) => {
      if (!agent) return '';
      const state = store.read(agent.session);
      if (state.enabled) return prompts.get(state.flavor)!;
      return state.configured || agent.session.header.parentSession !== undefined ? DISABLED_PROMPT : '';
    },
  });
  ctx.commands.register({
    name: 'pua',
    description: '开启 PUA 任务模式、切换风味、换方法或核查验收证据',
    input: { hint: '[on|off|flavor|review|again|done-check|evidence|status|help|任务描述]' },
    handler: invocation => handleCommand(store, { ...invocation, signal: AbortSignal.any([invocation.signal, lifetime.signal]) }, templates, ctx.get('subprocess')),
  });
}
