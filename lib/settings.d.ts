import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import type { PuaState } from './state.js';
import { type Configuration } from './configuration.js';
export interface Preferences extends Omit<Configuration, 'enabled'> {
    alwaysOn: boolean;
}
export declare const SETTINGS_NAMESPACE = "michengai-pua";
/** 0.1.6 及更早的设置页仍注册这份普通 schema。 */
export declare const SETTINGS_SCHEMA: Schema<Schemastery.ObjectS<NoInfer<{
    alwaysOn: Schema<boolean, boolean, "defined">;
    flavor: Schema<"alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "defined">;
    offline: Schema<boolean, boolean, "defined">;
    feedbackFrequency: Schema<number, number, "defined">;
    mode: Schema<"pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "defined">;
    language: Schema<"auto" | "zh-CN" | "en", "auto" | "zh-CN" | "en", "defined">;
    subagents: Schema<boolean, boolean, "defined">;
    terminalReview: Schema<boolean, boolean, "defined">;
    failureCandidates: Schema<boolean, boolean, "defined">;
    qualityTriggers: Schema<boolean, boolean, "defined">;
    integrityGuard: Schema<boolean, boolean, "defined">;
    maxIterations: Schema<number, number, "defined">;
    verify: Schema<string, string, "defined">;
    verificationTimeout: Schema<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    alwaysOn: Schema<boolean, boolean, "defined">;
    flavor: Schema<"alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "defined">;
    offline: Schema<boolean, boolean, "defined">;
    feedbackFrequency: Schema<number, number, "defined">;
    mode: Schema<"pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "defined">;
    language: Schema<"auto" | "zh-CN" | "en", "auto" | "zh-CN" | "en", "defined">;
    subagents: Schema<boolean, boolean, "defined">;
    terminalReview: Schema<boolean, boolean, "defined">;
    failureCandidates: Schema<boolean, boolean, "defined">;
    qualityTriggers: Schema<boolean, boolean, "defined">;
    integrityGuard: Schema<boolean, boolean, "defined">;
    maxIterations: Schema<number, number, "defined">;
    verify: Schema<string, string, "defined">;
    verificationTimeout: Schema<number, number, "defined">;
}>>, "plain">;
/**
 * 0.1.7 起全局配置是当前 Profile 条目的 volatile Config。
 * 旧 schemastery 没有 volatile()，这份 schema 保持普通对象，避免旧宿主加载失败。
 */
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    alwaysOn: Schema<boolean, boolean, "defined">;
    flavor: Schema<"alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "defined">;
    offline: Schema<boolean, boolean, "defined">;
    feedbackFrequency: Schema<number, number, "defined">;
    mode: Schema<"pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "defined">;
    language: Schema<"auto" | "zh-CN" | "en", "auto" | "zh-CN" | "en", "defined">;
    subagents: Schema<boolean, boolean, "defined">;
    terminalReview: Schema<boolean, boolean, "defined">;
    failureCandidates: Schema<boolean, boolean, "defined">;
    qualityTriggers: Schema<boolean, boolean, "defined">;
    integrityGuard: Schema<boolean, boolean, "defined">;
    maxIterations: Schema<number, number, "defined">;
    verify: Schema<string, string, "defined">;
    verificationTimeout: Schema<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    alwaysOn: Schema<boolean, boolean, "defined">;
    flavor: Schema<"alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "defined">;
    offline: Schema<boolean, boolean, "defined">;
    feedbackFrequency: Schema<number, number, "defined">;
    mode: Schema<"pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "defined">;
    language: Schema<"auto" | "zh-CN" | "en", "auto" | "zh-CN" | "en", "defined">;
    subagents: Schema<boolean, boolean, "defined">;
    terminalReview: Schema<boolean, boolean, "defined">;
    failureCandidates: Schema<boolean, boolean, "defined">;
    qualityTriggers: Schema<boolean, boolean, "defined">;
    integrityGuard: Schema<boolean, boolean, "defined">;
    maxIterations: Schema<number, number, "defined">;
    verify: Schema<string, string, "defined">;
    verificationTimeout: Schema<number, number, "defined">;
}>>, "plain">;
/** 把普通对象或 volatile 引用还原成设置值。缺字段时套用 schema 默认。 */
export declare function materializePreferences(config: unknown): Preferences | undefined;
/** 可选设置服务。旧宿主注册 settings.yaml；0.1.7 读取 Profile 里的 volatile 配置。都没有时仅当前会话生效。 */
export declare class PreferencesBridge {
    private readonly config;
    private scope;
    private mode;
    constructor(ctx: Context, config: unknown);
    private current;
    defaults(): Partial<PuaState>;
    configuration(): Configuration;
    /** 有设置服务时返回全局开关；没有设置服务时为 undefined，会话命令仍可使用。 */
    globallyEnabled(): boolean | undefined;
    description(): string;
    feedback(): {
        offline: boolean;
        frequency: number;
    };
}
