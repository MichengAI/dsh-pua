import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools';
export declare const TERMINAL_REVIEW_PROMPT = "PUA \u00B7 Terminal state needs verification: the output carries text markers for a non-zero exit, a timeout, or an abnormally ended shell, but the command itself may have printed them. Judge against the real error, the current sub-goal, and whatever independent check you need before picking a fix; never claim a failure count, pressure escalation, or passing acceptance from a marker alone.";
/** Gives a verification cue when a persistent terminal returns text only; forgeable output is never counted as a structured failure. */
export declare function terminalTextNeedsReview(result: Readonly<ToolExecutionResult>): boolean;
