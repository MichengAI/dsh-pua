import { handleCommand } from './command.js';
import { DISABLED_PROMPT, renderOriginalPrompt, loadCommandPrompts } from './content.js';
import { StateStore } from './state.js';
import { SourceCatalog } from './source.js';
import { Config, PreferencesBridge } from './settings.js';
import { PuaRuntime } from './runtime.js';
import { UI } from './i18n.js';
import { Service } from '@deepseek-ai/cordis';
/** Web Remote only reaches the configuration capability this plugin provides; it holds no other plugin's runtime state. */
export class PuaConfigurationService extends Service {
    store;
    preferences;
    runtime;
    constructor(ctx, store, preferences, runtime) {
        super(ctx, 'puaConfiguration');
        this.store = store;
        this.preferences = preferences;
        this.runtime = runtime;
    }
}
export const name = 'phucnd0604-pua-en';
export const inject = ['commands', 'systemPrompt'];
export { Config };
/** Registers the current session's PUA command and dynamic-behavior contract; Cordis automatically withdraws the contributions when the plugin unloads. */
export function apply(ctx, config) {
    const catalog = new SourceCatalog();
    const prompts = new Map();
    const templates = loadCommandPrompts();
    const preferences = new PreferencesBridge(ctx, config);
    const store = new StateStore(() => preferences.defaults(), session => {
        if ((session.header.delegationDepth ?? 0) === 0 || !session.header.parentSession)
            return undefined;
        return ctx.get('agents')?.get(session.header.parentSession)?.session;
    });
    const lifetime = new AbortController();
    ctx.effect(() => () => lifetime.abort());
    const runtime = new PuaRuntime(ctx, store, catalog, lifetime.signal, () => preferences.feedback());
    new PuaConfigurationService(ctx, store, preferences, runtime);
    ctx.systemPrompt.section({
        name: 'phucnd0604-pua-en',
        order: 120,
        text: ({ agent }) => {
            if (!agent)
                return '';
            const state = store.read(agent.session);
            if (state.enabled) {
                const flavor = state.flavorLocked ? state.flavor : 'auto';
                const mode = runtime.effectiveMode(agent.session, state.mode);
                const key = `${mode}/${flavor}`;
                if (!prompts.has(key))
                    prompts.set(key, renderOriginalPrompt(catalog, flavor, mode));
                return prompts.get(key);
            }
            if ((agent.session.header.delegationDepth ?? 0) > 0)
                return '';
            return state.configured || agent.session.header.parentSession !== undefined ? DISABLED_PROMPT : '';
        },
    });
    // The registry stores plain strings only; the slash menu overrides these two per UI language, so no copy mapping happens here.
    ctx.commands.register({
        name: 'pua',
        description: UI.zh.slash.pua.description,
        input: { hint: UI.zh.slash.pua.hint },
        handler: invocation => handleCommand(store, { ...invocation, signal: AbortSignal.any([invocation.signal, lifetime.signal]) }, templates, ctx.get('subprocess'), { catalog, preferences, runtime, ctx }),
    });
    ctx.commands.register({
        name: 'pua-cancel-loop', description: UI.zh.slash.cancelLoop.description,
        handler: invocation => {
            if (invocation.rawInput.trim())
                return { kind: 'error', text: 'pua-cancel-loop does not accept extra arguments.' };
            invocation.signal.throwIfAborted();
            runtime.cancel(invocation.agent.session);
            store.stage(invocation.agent.session, invocation.commandId, { kind: 'cancel-pua-loop' });
            return { kind: 'success', text: 'PUA · Current Loop cancelled.' };
        },
    });
}
//# sourceMappingURL=index.js.map