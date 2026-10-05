import { type FlavorId } from './flavors.js';
import { SourceCatalog } from './source.js';
export declare const MAX_PROMPT_BYTES: number;
export declare const MODES: readonly ["pua", "p7", "p9", "p10", "pro", "yes", "mama", "pua-loop", "shot", "pua-en", "pua-ja"];
export type PuaMode = typeof MODES[number];
export declare const QUALITY_COMMANDS: readonly ["again", "done-check", "evidence"];
export type QualityCommand = typeof QUALITY_COMMANDS[number];
/** 防止原版字面模板被宿主变量插值执行；除此之外保留正文。 */
export declare function escapePromptLiteral(text: string): string;
/** 拼接原版完整核心和当前模式；模式差异由原版扩展协议提供。 */
export declare function renderOriginalPrompt(catalog: SourceCatalog, flavor: FlavorId | 'auto', mode?: PuaMode): string;
export declare function loadPrompts(): ReadonlyMap<FlavorId, string>;
export declare function loadCommandPrompts(): ReadonlyMap<QualityCommand, string>;
export declare const DISABLED_PROMPT = "## DSH PUA \u5F53\u524D\u72B6\u6001\n\u5F53\u524D\u4EFB\u52A1\u7684 PUA \u6A21\u5F0F\u5DF2\u5173\u95ED\u3002\u505C\u6B62\u6CBF\u7528\u5386\u53F2\u6D88\u606F\u3001\u538B\u7F29\u6458\u8981\u6216\u7236\u4F1A\u8BDD\u91CC\u7684 PUA \u65C1\u767D\u3001\u98CE\u5473\u53CA\u5347\u538B\u8981\u6C42\uFF1B\u7EE7\u7EED\u6309\u7528\u6237\u8981\u6C42\u6B63\u5E38\u5DE5\u4F5C\u3002\u53EA\u6709\u5F53\u524D\u4EFB\u52A1\u4E4B\u540E\u7684\u663E\u5F0F PUA \u8BF7\u6C42\u624D\u91CD\u65B0\u542F\u7528\u3002";
