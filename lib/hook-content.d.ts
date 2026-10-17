import { SourceCatalog } from './source.js';
import type { PuaState } from './state.js';
/** Parses fixed-version templates only; never executes upstream shell or arbitrary variable expressions. */
export declare class HookContent {
    private readonly failure;
    private readonly flavors;
    private readonly frustration;
    readonly trigger: RegExp;
    constructor(catalog: SourceCatalog);
    private variables;
    private interpolate;
    frustrationPrompt(state: PuaState): string;
    candidate(count: number, state: PuaState): string;
}
