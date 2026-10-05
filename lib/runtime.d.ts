import type { Context } from "@deepseek-ai/cordis";
import type { Session, UserMessage } from "@deepseek-ai/dsh-session";
import type { ToolExecutionResult } from "@deepseek-ai/dsh-tools";
import type { SubprocessRuntime } from "@deepseek-ai/dsh-subprocess";
import type { Action } from "./args.js";
import { SourceCatalog } from "./source.js";
import { StateStore } from "./state.js";
import type { PuaMode } from "./content.js";
export declare const LOOP_START = "PUA_LOOP_START ";
type LoopAction = Extract<Action, {
    kind: "loop";
}>;
interface LoopState extends LoopAction {
    id: string;
    iteration: number;
    rejections: number;
    status: "active" | "paused" | "cancelled" | "complete" | "max_reached";
}
interface RuntimeState {
    failureCount: number;
    failures: string[];
    feedbackCount?: number;
    candidateCount?: number;
    loop?: LoopState;
}
export declare function pluginMessage(text: string): UserMessage;
/** 与原版一样，只接受终端结果的直接结构字段，不从 stdout 或嵌套 JSON 猜失败。 */
export declare function isTerminalFailure(result: Readonly<ToolExecutionResult>): boolean;
/** 独立验收执行用户提供的命令，120 秒超时；输出只作为证据，不作为指令。 */
export declare function verifyLoop(subprocess: Pick<SubprocessRuntime, "spawn">, command: string, cwd: string, signal: AbortSignal, timeoutMs?: number): Promise<{
    ok: boolean;
    detail: string;
}>;
/** 生命周期移植；完整状态留在日志，通过宿主 surface 替换只向模型提供说明。 */
export declare class PuaRuntime {
    private readonly ctx;
    private readonly store;
    private readonly lifetime;
    private readonly hooks;
    private readonly activeVerifiers;
    private readonly sessions;
    private readonly cache;
    private readonly normalized;
    private readonly pendingWrites;
    private readonly pendingCandidates;
    private readonly pendingTerminalReviews;
    constructor(ctx: Context, store: StateStore, catalog: SourceCatalog, lifetime: AbortSignal, feedback?: () => {
        offline: boolean;
        frequency: number;
    });
    read(session: Session): RuntimeState;
    private save;
    private flush;
    private hideLegacyRecords;
    cancel(session: Session, persist?: boolean): void;
    cancelAll(): number;
    /** 仅返回界面需要的观察数据，不暴露验收命令、任务原文或历史 JSON。 */
    activity(session: Session): {
        verifying: boolean;
        failureCount: number;
        loop: {
            iteration: number;
            maxIterations: number;
            rejections: number;
            verification: "command" | "model";
            verificationTimeout: number;
        } | null;
    };
    status(session: Session): string;
    effectiveMode(session: Session, mode: PuaMode): PuaMode;
    private stopping;
}
export {};
