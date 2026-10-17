import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import type { PuaState } from './state.js';
import { type Configuration } from './configuration.js';
export interface Preferences extends Omit<Configuration, 'enabled'> {
    alwaysOn: boolean;
}
export declare const SETTINGS_NAMESPACE = "michengai-pua";
/** 把字段声明还原成可校验的普通 schema。0.2.0 起 schemastery 提供 volatile()。 */
export declare const SETTINGS_SCHEMA: Schema<Schemastery.ObjectS<NoInfer<{
    alwaysOn: Schema<boolean, boolean, "defined">;
    flavor: Schema<"alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "defined">;
    offline: Schema<boolean, boolean, "defined">;
    feedbackFrequency: Schema<number, number, "defined">;
    mode: Schema<"pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "defined">;
    language: Schema<"auto" | "zh-CN" | "en" | "ru", "auto" | "zh-CN" | "en" | "ru", "defined">;
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
    language: Schema<"auto" | "zh-CN" | "en" | "ru", "auto" | "zh-CN" | "en" | "ru", "defined">;
    subagents: Schema<boolean, boolean, "defined">;
    terminalReview: Schema<boolean, boolean, "defined">;
    failureCandidates: Schema<boolean, boolean, "defined">;
    qualityTriggers: Schema<boolean, boolean, "defined">;
    integrityGuard: Schema<boolean, boolean, "defined">;
    maxIterations: Schema<number, number, "defined">;
    verify: Schema<string, string, "defined">;
    verificationTimeout: Schema<number, number, "defined">;
}>>, "plain">;
export declare const Config: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
    alwaysOn: Schema<boolean, boolean, "defined">;
    flavor: Schema<"alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "defined">;
    offline: Schema<boolean, boolean, "defined">;
    feedbackFrequency: Schema<number, number, "defined">;
    mode: Schema<"pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "defined">;
    language: Schema<"auto" | "zh-CN" | "en" | "ru", "auto" | "zh-CN" | "en" | "ru", "defined">;
    subagents: Schema<boolean, boolean, "defined">;
    terminalReview: Schema<boolean, boolean, "defined">;
    failureCandidates: Schema<boolean, boolean, "defined">;
    qualityTriggers: Schema<boolean, boolean, "defined">;
    integrityGuard: Schema<boolean, boolean, "defined">;
    maxIterations: Schema<number, number, "defined">;
    verify: Schema<string, string, "defined">;
    verificationTimeout: Schema<number, number, "defined">;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    alwaysOn: Schema<boolean, boolean, "defined">;
    flavor: Schema<"alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "alibaba" | "bytedance" | "huawei" | "tencent" | "baidu" | "pinduoduo" | "meituan" | "jd" | "xiaomi" | "netflix" | "tesla" | "apple" | "amazon" | "microsoft" | "ding" | "auto", "defined">;
    offline: Schema<boolean, boolean, "defined">;
    feedbackFrequency: Schema<number, number, "defined">;
    mode: Schema<"pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "pua" | "p7" | "p9" | "p10" | "pro" | "yes" | "mama" | "shot" | "pua-en" | "pua-ja", "defined">;
    language: Schema<"auto" | "zh-CN" | "en" | "ru", "auto" | "zh-CN" | "en" | "ru", "defined">;
    subagents: Schema<boolean, boolean, "defined">;
    terminalReview: Schema<boolean, boolean, "defined">;
    failureCandidates: Schema<boolean, boolean, "defined">;
    qualityTriggers: Schema<boolean, boolean, "defined">;
    integrityGuard: Schema<boolean, boolean, "defined">;
    maxIterations: Schema<number, number, "defined">;
    verify: Schema<string, string, "defined">;
    verificationTimeout: Schema<number, number, "defined">;
}>>>, "volatile">;
/** 把普通对象或 volatile 引用还原成设置值。缺字段时套用 schema 默认。 */
export declare function materializePreferences(config: unknown): Preferences | undefined;
/** 可选设置服务。0.2.0 起读取 Profile 里的 volatile 配置；没有该服务时仅当前会话生效。 */
export declare class PreferencesBridge {
    private readonly config;
    private ready;
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
