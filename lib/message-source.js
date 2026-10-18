export const RUNTIME_PLUGIN = '@phucnd0604/dsh-pua-en/runtime';
export const COMMAND_PLUGIN = '@phucnd0604/dsh-pua-en';
/** Since 0.2.0 the session format is V4, so only "plugin:<name>" is written. The read side still recognizes the older { kind: 'plugin', plugin } shape found in earlier logs. */
export function pluginSource(plugin) {
    return { kind: 'plugin:' + plugin };
}
export function isPluginSource(source, plugin) {
    if (!source?.kind)
        return false;
    return source.kind === 'plugin:' + plugin || (source.kind === 'plugin' && source.plugin === plugin);
}
//# sourceMappingURL=message-source.js.map