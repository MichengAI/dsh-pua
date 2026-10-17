import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session';
export const RUNTIME_PLUGIN = '@phucnd0604/dsh-pua-en/runtime';
export const COMMAND_PLUGIN = '@phucnd0604/dsh-pua-en';
/** Since 0.1.7, native V4 rejects `{ kind: 'plugin', plugin }`; the source kind became `plugin:<name>`. */
const formatVersion = SESSION_FORMAT_VERSION;
/** Writes a plugin message source the current host will accept. The read side still recognizes both shapes. */
export function pluginSource(plugin) {
    if (formatVersion >= 4)
        return { kind: `plugin:${plugin}` };
    // The old host's kind is not declared in 0.1.7; once the compile baseline moved to the RC, it can only be contained here.
    return { kind: 'plugin', plugin };
}
export function isPluginSource(source, plugin) {
    if (!source?.kind)
        return false;
    return source.kind === `plugin:${plugin}` || (source.kind === 'plugin' && source.plugin === plugin);
}
//# sourceMappingURL=message-source.js.map