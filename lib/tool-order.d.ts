import { type Session } from '@deepseek-ai/dsh-session';
/** Incrementally checks the whole call group from the raw log; includes parallel calls that are declared but not yet dispatched. */
export declare function hasPendingToolCalls(session: Session): boolean;
/**
 * Repairs the complete historical tool group that this plugin interrupted. Only model-context
 * replacements are appended; raw events are never rewritten. The original tool results were
 * user-role messages to begin with; the generic user/message projection preserves their full
 * id, tool source, and content while shadowing the preceding PUA node and the result node,
 * so tools are never faked or re-executed.
 */
export declare function repairPuaToolOrder(session: Session, plugin: string): void;
