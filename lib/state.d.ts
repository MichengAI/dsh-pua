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
 * Recovers configuration from successful commands logged by this session itself. The fork prefix is not replayed; storage is owned by the host profile.
 * The staging map only covers the gap from the synchronous handler to the command/done log entry, so a wake-up never reads stale configuration.
 */
export declare class StateStore {
    private readonly defaults;
    private readonly parent;
    private readonly pending;
    private readonly cache;
    constructor(defaults?: () => Partial<PuaState>, parent?: (session: Session) => Session | undefined);
    /** Configuration is persisted as native command log entries: no model message is appended and no tool-message group is inserted. */
    configure(session: Session, value: unknown, expectedRevision?: number): void;
    overrides(session: Session): Partial<Configuration>;
    revision(session: Session): number;
    configuration(session: Session): Configuration;
    stage(session: Session, commandId: string, action: Action): void;
    rollback(session: Session, commandId: string): void;
    private invalidate;
    read(session: Session): PuaState;
}
