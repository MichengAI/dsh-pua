import type { MessageSource } from '@deepseek-ai/dsh-llm';
export declare const RUNTIME_PLUGIN = "@phucnd0604/dsh-pua-en/runtime";
export declare const COMMAND_PLUGIN = "@phucnd0604/dsh-pua-en";
/** Since 0.2.0 the session format is V4, so only "plugin:<name>" is written. The read side still recognizes the older { kind: 'plugin', plugin } shape found in earlier logs. */
export declare function pluginSource(plugin: string): MessageSource;
export declare function isPluginSource(source: {
    kind?: string;
    plugin?: string;
} | null | undefined, plugin: string): boolean;
