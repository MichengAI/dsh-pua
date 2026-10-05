import { type Session } from '@deepseek-ai/dsh-session';
/** 从原始日志增量检查整组调用；包含已声明但尚未派发的并行调用。 */
export declare function hasPendingToolCalls(session: Session): boolean;
/**
 * 兼容本插件打断的完整历史工具组。只追加模型上下文替换，不改写原始事件。
 * 原工具结果本来就是 user-role 消息；使用通用 user/message 投影保留其完整
 * id、tool 来源和 content，覆盖前置 PUA 节点与结果节点，避免伪造或重执行工具。
 */
export declare function repairPuaToolOrder(session: Session, plugin: string): void;
