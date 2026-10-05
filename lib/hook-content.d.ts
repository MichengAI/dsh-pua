import { SourceCatalog } from './source.js';
import type { PuaState } from './state.js';
/** 只解析固定版本的模板，不执行上游 shell 或任意变量表达式。 */
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
