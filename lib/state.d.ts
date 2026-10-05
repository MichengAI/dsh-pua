import type { Session } from '@deepseek-ai/dsh-session';
import { type Action } from './args.js';
import type { FlavorId } from './flavors.js';
import type { PuaMode } from './content.js';
import { type Configuration } from './configuration.js';
export interface PuaState extends Omit<Configuration, 'flavor' | 'mode'> {
    readonly enabled: boolean;
    readonly configured: boolean;
    readonly flavor: FlavorId;
    readonly flavorLocked: boolean;
    readonly mode: PuaMode;
    readonly loopCommandId?: string;
}
export declare const RESULT_PREFIX = "PUA \u00B7 ";
export declare const SESSION_RESULT_PREFIX: string;
export declare function transition(state: PuaState, action: Action): PuaState;
/**
 * 从当前会话自己的成功命令恢复配置。分叉前缀不参与恢复，存储归宿主 profile 管理。
 * 暂存只覆盖同步 handler 到 command/done 落日志的间隙，避免唤醒时读到旧配置。
 */
export declare class StateStore {
    private readonly defaults;
    private readonly parent;
    private readonly pending;
    private readonly cache;
    constructor(defaults?: () => Partial<PuaState>, parent?: (session: Session) => Session | undefined);
    /** 配置以原生命令日志保存，不追加模型消息，不会插入工具消息组。 */
    configure(session: Session, value: unknown, expectedRevision?: number): void;
    overrides(session: Session): Partial<Configuration>;
    revision(session: Session): number;
    configuration(session: Session): Configuration;
    stage(session: Session, commandId: string, action: Action): void;
    rollback(session: Session, commandId: string): void;
    private invalidate;
    read(session: Session): PuaState;
}
