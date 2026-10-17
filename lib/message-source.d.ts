import type { MessageSource } from '@deepseek-ai/dsh-llm';
export declare const RUNTIME_PLUGIN = "@michengai/dsh-pua/runtime";
export declare const COMMAND_PLUGIN = "@michengai/dsh-pua";
/** 0.2.0 起会话格式为 V4，只写入 `plugin:<name>`。读取仍认识更早日志里的 `{ kind: 'plugin', plugin }`。 */
export declare function pluginSource(plugin: string): MessageSource;
export declare function isPluginSource(source: {
    kind?: string;
    plugin?: string;
} | null | undefined, plugin: string): boolean;
