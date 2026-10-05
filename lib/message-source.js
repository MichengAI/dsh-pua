import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session';
export const RUNTIME_PLUGIN = '@michengai/dsh-pua/runtime';
export const COMMAND_PLUGIN = '@michengai/dsh-pua';
/** 0.1.7 起原生 V4 拒绝 `{ kind: 'plugin', plugin }`，来源 kind 改为 `plugin:<name>`。 */
const formatVersion = SESSION_FORMAT_VERSION;
/** 按当前宿主写入可被接纳的插件消息来源。读取侧仍同时认识两种形态。 */
export function pluginSource(plugin) {
    if (formatVersion >= 4)
        return { kind: `plugin:${plugin}` };
    // 旧宿主的 kind 不在 0.1.7 声明里，编译基线抬到 RC 后只能在此收容。
    return { kind: 'plugin', plugin };
}
export function isPluginSource(source, plugin) {
    if (!source?.kind)
        return false;
    return source.kind === `plugin:${plugin}` || (source.kind === 'plugin' && source.plugin === plugin);
}
//# sourceMappingURL=message-source.js.map