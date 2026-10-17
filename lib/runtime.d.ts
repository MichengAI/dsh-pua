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
/** Like the original, only the terminal result's direct structural fields count; never guess a failure from stdout or nested JSON. */
export declare function isTerminalFailure(result: Readonly<ToolExecutionResult>): boolean;
/** Runs the user-provided command for independent acceptance with a 120-second timeout; output is evidence, never instruction. */
export declare function verifyLoop(subprocess: Pick<SubprocessRuntime, "spawn">, command: string, cwd: string, signal: AbortSignal, timeoutMs?: number): Promise<{
    ok: boolean;
    detail: string;
}>;
/** Lifetime port; full state stays in the log, and only the note reaches the model via a host surface replacement. */
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
    /** Returns only the observation data the UI needs, never the acceptance command, the original task text, or historical JSON. */
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
