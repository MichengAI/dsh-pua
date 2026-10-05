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
            return { ...state, enabled: true, configured: true, mode: action.mode, ...(action.task.startsWith('使用钉内/钉外味。') ? { flavor: 'ding', flavorLocked: true } : {}) };
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
 * 从当前会话自己的成功命令恢复配置。分叉前缀不参与恢复，存储归宿主 profile 管理。
 * 暂存只覆盖同步 handler 到 command/done 落日志的间隙，避免唤醒时读到旧配置。
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
    /** 配置以原生命令日志保存，不追加模型消息，不会插入工具消息组。 */
    configure(session, value, expectedRevision) {
        const patch = parsePatch(value);
        if (expectedRevision !== undefined && expectedRevision !== this.revision(session))
            throw new Error('配置已被其他窗口修改，请刷新后重试。');
        const commandId = CommandId(randomUUID());
        session.append('command/run', { commandId, name: 'pua', args: 'config ' + JSON.stringify(patch), source: { kind: 'user' } });
        session.append('command/done', { commandId, kind: 'success', text: SESSION_RESULT_PREFIX + '配置已保存。' });
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
        // Session 日志只追加；从分叉继承边界开始，每个命令结果只解析一次。
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
                    // 0.1.0 将 in / pua flavor 当成任务；尊重已记录结果，不用新语法改写旧状态。
                    if (outcome.startsWith(RESULT_PREFIX + '已提交任务请求，'))
                        record.action = { kind: 'activate', task: record.input };
                    else {
                        try {
                            record.action = parseArgs(record.input);
                        }
                        catch { /* 不认识的历史命令保留在日志中，不猜测其配置语义。 */ }
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
        // 按进入命令的顺序折叠，避免并发 handler 的完成顺序改变配置语义。
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
                // 旧版任务激活和关闭会重置角色；仅新命令使用保留角色的语义。
                if (record.legacy && (action.kind === 'activate' || action.kind === 'off')) {
                    state = { ...state, mode: 'pua' };
                    overrides.mode = 'pua';
                }
                const keys = action.kind === 'flavor' ? ['flavor'] : action.kind === 'mode' ? ['enabled', 'mode', ...(action.task.startsWith('使用钉内/钉外味。') ? ['flavor'] : [])] : action.kind === 'offline' ? ['offline'] : ['on', 'off', 'activate', 'again', 'done-check', 'evidence', 'survey'].includes(action.kind) ? ['enabled'] : ['review', 'kpi', 'loop'].includes(action.kind) ? ['enabled', 'mode'] : ['cancel-pua-loop', 'teardown-all'].includes(action.kind) ? ['mode'] : [];
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