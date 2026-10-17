import type { Context } from '@deepseek-ai/cordis';
import { StateStore } from './state.js';
import { Config, PreferencesBridge } from './settings.js';
import { PuaRuntime } from './runtime.js';
import { Service } from '@deepseek-ai/cordis';
/** Web Remote only reaches the configuration capability this plugin provides; it holds no other plugin's runtime state. */
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
export declare const name = "phucnd0604-pua-en";
export declare const inject: string[];
export { Config };
/** Registers the current session's PUA command and dynamic-behavior contract; Cordis automatically withdraws the contributions when the plugin unloads. */
export declare function apply(ctx: Context, config?: unknown): void;
