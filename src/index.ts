import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-system-prompt';
import { handleCommand } from './command.js';
import { disabledPrompt, renderOriginalPrompt, loadCommandPrompts } from './content.js';
import { StateStore } from './state.js';
import { SourceCatalog } from './source.js';
import { Config, PreferencesBridge } from './settings.js';
import { PuaRuntime } from './runtime.js';
import { Service } from '@deepseek-ai/cordis';
import { serverCopy } from './server-copy.js';

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
        const key = `${mode}/${flavor}/${preferences.language()}`;
        if (!prompts.has(key)) prompts.set(key, renderOriginalPrompt(catalog, flavor, mode));
        return prompts.get(key)!;
      }
      if ((agent.session.header.delegationDepth ?? 0) > 0) return '';
      return state.configured || agent.session.header.parentSession !== undefined ? disabledPrompt() : '';
    },
  });
  // 命令描述与 hint 被宿主断言为普通字符串，无法用文案映射；语言变化时重注册。
  const registerCommands = (): (() => void) => {
    const copy = serverCopy().commands;
    const disposePua = ctx.commands.register({
      name: 'pua',
      description: copy.pua,
      input: { hint: copy.puaHint },
      handler: invocation => handleCommand(store, { ...invocation, signal: AbortSignal.any([invocation.signal, lifetime.signal]) }, templates, ctx.get('subprocess'), { catalog, preferences, runtime, ctx }),
    });
    const disposeCancel = ctx.commands.register({
      name: 'pua-cancel-loop', description: copy.cancelLoop,
      handler: invocation => {
        if (invocation.rawInput.trim()) return { kind: 'error', text: serverCopy().commands.cancelLoopExtra };
        invocation.signal.throwIfAborted();
        runtime.cancel(invocation.agent.session);
        store.stage(invocation.agent.session, invocation.commandId, { kind: 'cancel-pua-loop' });
        return { kind: 'success', text: serverCopy().commands.cancelLoopDone };
      },
    });
    return () => { disposePua(); disposeCancel(); };
  };
  let appliedLanguage = preferences.language();
  let disposeCommands = registerCommands();
  /** 设置页或 volatile 配置改变语言后立即换用新文案，并刷新命令元数据。 */
  const onLanguageChange = () => {
    const next = preferences.language();
    if (next === appliedLanguage) return;
    appliedLanguage = next;
    disposeCommands();
    disposeCommands = registerCommands();
  };
  // 宿主 Events 未声明这两个事件名；沿用本插件已有的绑定式断言（见 runtime.ts）。
  const listen = ctx.on.bind(ctx) as (event: 'loader/volatile-update' | 'settings/document-updated', listener: () => void) => () => void;
  listen('loader/volatile-update', onLanguageChange);
  listen('settings/document-updated', onLanguageChange);
}
