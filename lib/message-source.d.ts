import type { MessageSource } from '@deepseek-ai/dsh-llm';
export declare const RUNTIME_PLUGIN = "@phucnd0604/dsh-pua-en/runtime";
export declare const COMMAND_PLUGIN = "@phucnd0604/dsh-pua-en";
/** Writes a plugin message source the current host will accept. The read side still recognizes both shapes. */
export declare function pluginSource(plugin: string): MessageSource;
export declare function isPluginSource(source: {
    kind?: string;
    plugin?: string;
} | null | undefined, plugin: string): boolean;
