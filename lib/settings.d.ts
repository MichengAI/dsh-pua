import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import type { PuaState } from './state.js';
import { type Configuration } from './configuration.js';
export interface Preferences extends Omit<Configuration, 'enabled'> {
    alwaysOn: boolean;
}
export declare const SETTINGS_NAMESPACE = "phucnd0604-pua-en";
/** Reduces the field declarations to a plain schema that can still be validated. Since 0.2.0 schemastery provides volatile(). */
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
/** Reduces a plain object or a volatile reference to setting values. Missing fields fall back to the schema defaults. */
export declare function materializePreferences(config: unknown): Preferences | undefined;
/** Optional settings service. Since 0.2.0 it reads the volatile configuration in the Profile; without that service, changes only affect the current session. */
export declare class PreferencesBridge {
    private readonly config;
    private ready;
    constructor(ctx: Context, config: unknown);
    private current;
    defaults(): Partial<PuaState>;
    configuration(): Configuration;
    /** Returns the global switch when a settings service exists; undefined when none does, in which case session commands still work. */
    globallyEnabled(): boolean | undefined;
    description(): string;
    feedback(): {
        offline: boolean;
        frequency: number;
    };
}
