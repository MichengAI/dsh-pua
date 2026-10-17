import { parseArgs } from './args.js';
import { CONFIG_DEFAULTS, CONFIG_KEYS, parsePatch } from './configuration.js';
import { randomUUID } from 'node:crypto';
import { CommandId } from '@deepseek-ai/dsh-commands';
const DEFAULT_STATE = Object.freeze({ ...CONFIG_DEFAULTS, enabled: false, configured: false, flavor: 'alibaba', flavorLocked: false, mode: 'pua' });
export const RESULT_PREFIX = 'PUA · ';
export const SESSION_RESULT_PREFIX = RESULT_PREFIX + '会话 · ';
export function transition(state, action) {
    switch (action.kind) {
        case 'on':
        case 'again':
        case 'done-check':
        case 'evidence':
        case 'survey':
            return { ...state, enabled: true, configured: true };
        case 'kpi':
            return { ...state, enabled: true, configured: true, mode: 'pro' };
        case 'activate':
            return { ...state, enabled: true, configured: true };
        case 'review':
            return { ...state, enabled: true, configured: true, mode: 'pua' };
        case 'mode':
            return { ...state, enabled: true, configured: true, mode: action.mode, ...(action.task.startsWith('Use the Ding-inside/Ding-outside flavor.') ? { flavor: 'ding', flavorLocked: true } : {}) };
        case 'loop':
            return { ...state, enabled: true, configured: true, mode: 'pua-loop' };
        case 'cancel-pua-loop':
        case 'teardown-all':
            return { ...state, mode: 'pua' };
        case 'off': {
            const { loopCommandId: _loop, ...rest } = state;
            return { ...rest, enabled: false, configured: true, mode: state.mode === 'pua-loop' ? 'pua' : state.mode };
        }
        case 'offline':
            return { ...state, offline: true };
        case 'flavor':
            return { ...state, flavor: action.flavor === 'auto' ? 'alibaba' : action.flavor, flavorLocked: action.flavor !== 'auto' };
        default:
            return state;
    }
}
/**
 * Recovers configuration from successful commands logged by this session itself. The fork prefix is not replayed; storage is owned by the host profile.
 * The staging map only covers the gap from the synchronous handler to the command/done log entry, so a wake-up never reads stale configuration.
 */
export class StateStore {
    defaults;
    parent;
    pending = new WeakMap();
    cache = new WeakMap();
    constructor(defaults = () => ({}), parent = () => undefined) {
        this.defaults = defaults;
        this.parent = parent;
    }
    /** Configuration is persisted as native command log entries: no model message is appended and no tool-message group is inserted. */
    configure(session, value, expectedRevision) {
        const patch = parsePatch(value);
        if (expectedRevision !== undefined && expectedRevision !== this.revision(session))
            throw new Error('The configuration was changed by another window; refresh and retry.');
        const commandId = CommandId(randomUUID());
        session.append('command/run', { commandId, name: 'pua', args: 'config ' + JSON.stringify(patch), source: { kind: 'user' } });
        session.append('command/done', { commandId, kind: 'success', text: SESSION_RESULT_PREFIX + 'Configuration saved.' });
        this.invalidate(session);
    }
    overrides(session) { this.read(session); return { ...this.cache.get(session)?.overrides }; }
    revision(session) { this.read(session); return this.cache.get(session)?.revision ?? 0; }
    configuration(session) {
        const state = this.read(session);
        return Object.fromEntries(CONFIG_KEYS.map(key => [key, key === 'flavor' ? (state.flavorLocked ? state.flavor : 'auto') : key === 'mode' && state.mode === 'pua-loop' ? 'pua' : state[key]]));
    }
    stage(session, commandId, action) {
        let pending = this.pending.get(session);
        if (!pending)
            this.pending.set(session, pending = new Map());
        pending.set(commandId, action);
        this.invalidate(session);
    }
    rollback(session, commandId) {
        this.pending.get(session)?.delete(commandId);
        this.invalidate(session);
    }
    invalidate(session) {
        const cache = this.cache.get(session);
        if (cache)
            delete cache.state;
    }
    read(session) {
        let cache = this.cache.get(session);
        if (!cache) {
            cache = { cursor: session.inheritedEventCount, commands: new Map() };
            this.cache.set(session, cache);
        }
        const pending = this.pending.get(session);
        // The session log is append-only; starting at the fork-inheritance boundary, each command result is parsed exactly once.
        for (const event of session.snapshotEvents(cache.cursor)) {
            if (event.type === 'command/run' && event.data.name === 'pua' && typeof event.data.args === 'string') {
                cache.commands.set(event.data.commandId, { input: event.data.args, done: false });
                delete cache.state;
            }
            else if (event.type === 'command/run' && (event.data.name === 'pua-cancel-loop' || event.data.name === 'cancel-pua-loop')) {
                cache.commands.set(event.data.commandId, { input: 'cancel-pua-loop', done: false });
                delete cache.state;
            }
            else if (event.type === 'command/done' && cache.commands.has(event.data.commandId)) {
                const record = cache.commands.get(event.data.commandId);
                record.done = true;
                delete record.action;
                const outcome = event.data.text;
                if (event.data.kind === 'success' && outcome?.startsWith(RESULT_PREFIX)) {
                    record.legacy = !outcome.startsWith(SESSION_RESULT_PREFIX);
                    // 0.1.0 treated in / pua flavor as a task; respect the recorded result and do not rewrite old state with new syntax.
                    if (outcome.startsWith(RESULT_PREFIX + '已提交任务请求，'))
                        record.action = { kind: 'activate', task: record.input };
                    else {
                        try {
                            record.action = parseArgs(record.input);
                        }
                        catch { /* Unrecognized historical commands stay in the log; their configuration semantics are not guessed. */ }
                    }
                }
                pending?.delete(event.data.commandId);
                delete cache.state;
            }
        }
        cache.cursor = session.seq;
        const parent = this.parent(session);
        const inherited = parent ? this.configuration(parent) : undefined;
        const child = (session.header.delegationDepth ?? 0) > 0;
        const defaults = inherited ? { ...inherited, flavor: inherited.flavor === 'auto' ? 'alibaba' : inherited.flavor, flavorLocked: inherited.flavor !== 'auto' } : this.defaults();
        const defaultsKey = JSON.stringify(defaults);
        if (cache.state && cache.defaultsKey === defaultsKey)
            return cache.state;
        let state = { ...DEFAULT_STATE, ...defaults };
        const baseline = state;
        const overrides = {};
        let revision = 0;
        // Fold in command-entry order so the completion order of concurrent handlers cannot change configuration semantics.
        for (const [id, record] of cache.commands) {
            const action = record.done ? record.action : pending?.get(id);
            const before = JSON.stringify(overrides);
            const patch = action?.kind === 'configure' ? action.patch : undefined;
            if (patch) {
                for (const key of CONFIG_KEYS)
                    if (key in patch) {
                        const value = patch[key];
                        if (value === null)
                            delete overrides[key];
                        else
                            Object.assign(overrides, { [key]: value });
                        if (key === 'flavor')
                            state = { ...state, flavor: value === null ? baseline.flavor : value === 'auto' ? 'alibaba' : value, flavorLocked: value === null ? baseline.flavorLocked : value !== 'auto' };
                        else
                            state = { ...state, [key]: value === null ? baseline[key] : value };
                        if (key === 'enabled' && !state.enabled && state.mode === 'pua-loop') {
                            const { loopCommandId: _loop, ...rest } = state;
                            state = { ...rest, mode: 'pua' };
                        }
                    }
                if (record.done && JSON.stringify(overrides) !== before)
                    revision++;
                continue;
            }
            if (action) {
                state = transition(state, action);
                // Legacy task activation and off reset the role; only new commands use the role-preserving semantics.
                if (record.legacy && (action.kind === 'activate' || action.kind === 'off')) {
                    state = { ...state, mode: 'pua' };
                    overrides.mode = 'pua';
                }
                const keys = action.kind === 'flavor' ? ['flavor'] : action.kind === 'mode' ? ['enabled', 'mode', ...(action.task.startsWith('Use the Ding-inside/Ding-outside flavor.') ? ['flavor'] : [])] : action.kind === 'offline' ? ['offline'] : ['on', 'off', 'activate', 'again', 'done-check', 'evidence', 'survey'].includes(action.kind) ? ['enabled'] : ['review', 'kpi', 'loop'].includes(action.kind) ? ['enabled', 'mode'] : ['cancel-pua-loop', 'teardown-all'].includes(action.kind) ? ['mode'] : [];
                for (const key of keys)
                    Object.assign(overrides, { [key]: key === 'flavor' ? state.flavorLocked ? state.flavor : 'auto' : key === 'mode' && state.mode === 'pua-loop' ? 'pua' : state[key] });
                if (action.kind === 'loop')
                    state = { ...state, loopCommandId: id };
                if (record.done && JSON.stringify(overrides) !== before)
                    revision++;
            }
        }
        if (child && (!inherited || !inherited.enabled || !inherited.subagents))
            state = { ...state, enabled: false };
        cache.overrides = overrides;
        cache.revision = revision;
        cache.defaultsKey = defaultsKey;
        cache.state = Object.freeze(state);
        return cache.state;
    }
}
//# sourceMappingURL=state.js.map