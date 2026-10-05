import type { MessageSource } from '@deepseek-ai/dsh-llm';
export declare const RUNTIME_PLUGIN = "@michengai/dsh-pua/runtime";
export declare const COMMAND_PLUGIN = "@michengai/dsh-pua";
/** 按当前宿主写入可被接纳的插件消息来源。读取侧仍同时认识两种形态。 */
export declare function pluginSource(plugin: string): MessageSource;
export declare function isPluginSource(source: {
    kind?: string;
    plugin?: string;
} | null | undefined, plugin: string): boolean;
