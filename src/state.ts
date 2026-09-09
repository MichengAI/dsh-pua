import type { Session } from '@deepseek-ai/dsh-session';
import type {} from '@deepseek-ai/dsh-commands';
import { parseArgs, type Action } from './args.js';
import type { FlavorId } from './flavors.js';
import type { PuaMode } from './content.js';

export interface PuaState {
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly flavor: FlavorId;
  readonly flavorLocked: boolean;
  readonly mode: PuaMode;
  readonly loopCommandId?: string;
}

const DEFAULT_STATE: PuaState = Object.freeze({ enabled: false, configured: false, flavor: 'alibaba', flavorLocked: false, mode: 'pua' });
export const RESULT_PREFIX = 'PUA · ';

export function transition(state: PuaState, action: Action): PuaState {
  switch (action.kind) {
    case 'on': case 'again': case 'done-check': case 'evidence': case 'survey':
      return { ...state, enabled: true, configured: true };
    case 'kpi':
      return { ...state, enabled: true, configured: true, mode: 'pro' };
    case 'activate': case 'review':
      return { ...state, enabled: true, configured: true, mode: 'pua' };
    case 'mode':
      return { ...state, enabled: true, configured: true, mode: action.mode, ...(action.task.startsWith('使用钉内/钉外味。') ? { flavor: 'ding' as const, flavorLocked: true } : {}) };
    case 'loop':
      return { ...state, enabled: true, configured: true, mode: 'pua-loop' };
    case 'cancel-pua-loop': case 'teardown-all':
      return { ...state, mode: 'pua' };
    case 'off':
      return { ...state, enabled: false, configured: true, mode: 'pua' };
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
  private readonly pending = new WeakMap<Session, Map<string, Action>>();
  constructor(private readonly defaults: () => Partial<PuaState> = () => ({})) {}

  stage(session: Session, commandId: string, action: Action): void {
    let pending = this.pending.get(session);
    if (!pending) this.pending.set(session, pending = new Map());
    pending.set(commandId, action);
  }

  rollback(session: Session, commandId: string): void {
    this.pending.get(session)?.delete(commandId);
  }

  read(session: Session): PuaState {
    const inputs = new Map<string, string>();
    const outcomes = new Map<string, string | undefined>();
    const pending = this.pending.get(session);
    for (const event of session.ownEvents()) {
      if (event.type === 'command/run' && event.data.name === 'pua' && typeof event.data.args === 'string') {
        inputs.set(event.data.commandId, event.data.args);
      } else if (event.type === 'command/run' && event.data.name === 'cancel-pua-loop') {
        inputs.set(event.data.commandId, 'cancel-pua-loop');
      } else if (event.type === 'command/done' && inputs.has(event.data.commandId)) {
        outcomes.set(event.data.commandId, event.data.kind === 'success' && event.data.text?.startsWith(RESULT_PREFIX) === true ? event.data.text : undefined);
        pending?.delete(event.data.commandId);
      }
    }
    let state = { ...DEFAULT_STATE, ...this.defaults() };
    // 按进入命令的顺序折叠，避免并发 handler 的完成顺序改变配置语义。
    for (const [id, input] of inputs) {
      const outcome = outcomes.get(id);
      let action = !outcomes.has(id) ? pending?.get(id) : undefined;
      if (outcome !== undefined) {
        // 0.1.0 将 in / pua flavor 当成任务；尊重已记录结果，不用新语法改写旧状态。
        if (outcome.startsWith(RESULT_PREFIX + '已提交任务请求，')) action = { kind: 'activate', task: input };
        else {
          try { action = parseArgs(input); }
          catch { /* 不认识的历史命令保留在日志中，不猜测其配置语义。 */ }
        }
      }
      if (action) {
        state = transition(state, action);
        if (action.kind === 'loop') state = { ...state, loopCommandId: id };
      }
    }
    return state;
  }
}
