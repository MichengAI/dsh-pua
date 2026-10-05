import type { Context } from '@deepseek-ai/cordis';
import { StateStore } from './state.js';
import { Config, PreferencesBridge } from './settings.js';
import { PuaRuntime } from './runtime.js';
import { Service } from '@deepseek-ai/cordis';
/** Web Remote 仅访问此插件提供的配置能力，不持有其他插件的运行状态。 */
export declare class PuaConfigurationService extends Service {
    readonly store: StateStore;
    readonly preferences: PreferencesBridge;
    readonly runtime: PuaRuntime;
    constructor(ctx: Context, store: StateStore, preferences: PreferencesBridge, runtime: PuaRuntime);
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        puaConfiguration: PuaConfigurationService;
    }
}
export declare const name = "michengai-pua";
export declare const inject: string[];
export { Config };
/** 注册当前会话的 PUA 命令与动态行为契约；Cordis 自动随插件卸载撤销贡献。 */
export declare function apply(ctx: Context, config?: unknown): void;
