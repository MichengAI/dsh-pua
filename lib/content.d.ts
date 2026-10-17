import { type FlavorId } from './flavors.js';
import { SourceCatalog } from './source.js';
export declare const MAX_PROMPT_BYTES: number;
export declare const MODES: readonly ["pua", "p7", "p9", "p10", "pro", "yes", "mama", "pua-loop", "shot", "pua-en", "pua-ja"];
export type PuaMode = typeof MODES[number];
export declare const QUALITY_COMMANDS: readonly ["again", "done-check", "evidence"];
export type QualityCommand = typeof QUALITY_COMMANDS[number];
/** Prevents original literal templates from being interpolated by host variables; otherwise the body is preserved. */
export declare function escapePromptLiteral(text: string): string;
/** Joins the full original core with the current mode; mode differences come from the original extension protocols. */
export declare function renderOriginalPrompt(catalog: SourceCatalog, flavor: FlavorId | 'auto', mode?: PuaMode): string;
export declare function loadPrompts(): ReadonlyMap<FlavorId, string>;
export declare function loadCommandPrompts(): ReadonlyMap<QualityCommand, string>;
export declare const DISABLED_PROMPT = "## Current DSH PUA state\nPUA mode is off for the current task. Stop carrying over PUA narration, flavor, and pressure-escalation requirements from earlier messages, compacted summaries, or the parent session; continue working normally as the user asks. Only an explicit PUA request made after this point re-enables it.";
