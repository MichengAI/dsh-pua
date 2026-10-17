export const RUNTIME_PLUGIN = '@michengai/dsh-pua/runtime';
export const COMMAND_PLUGIN = '@michengai/dsh-pua';
/** 0.2.0 起会话格式为 V4，只写入 `plugin:<name>`。读取仍认识更早日志里的 `{ kind: 'plugin', plugin }`。 */
export function pluginSource(plugin) {
    return { kind: `plugin:${plugin}` };
}
export function isPluginSource(source, plugin) {
    if (!source?.kind)
        return false;
    return source.kind === `plugin:${plugin}` || (source.kind === 'plugin' && source.plugin === plugin);
}
//# sourceMappingURL=message-source.js.map