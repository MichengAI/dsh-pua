import type { MessageSource } from '@deepseek-ai/dsh-llm';

export const RUNTIME_PLUGIN = '@phucnd0604/dsh-pua-en/runtime';
export const COMMAND_PLUGIN = '@phucnd0604/dsh-pua-en';

/** Since 0.2.0 the session format is V4, so only "plugin:<name>" is written. The read side still recognizes the older { kind: 'plugin', plugin } shape found in earlier logs. */
export function pluginSource(plugin: string): MessageSource {
  return { kind: 'plugin:' + plugin } as unknown as MessageSource;
}

export function isPluginSource(source: { kind?: string; plugin?: string } | null | undefined, plugin: string): boolean {
  if (!source?.kind) return false;
  return source.kind === 'plugin:' + plugin || (source.kind === 'plugin' && source.plugin === plugin);
}
