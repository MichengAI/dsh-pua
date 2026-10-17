import { z } from 'zod';
/** Parameter contract shared by global defaults and session overrides; null means "restore inheritance" only inside an override patch. */
export declare const CONFIG_MODES: readonly ["pua", "p7", "p9", "p10", "pro", "yes", "mama", "shot", "pua-en", "pua-ja"];
/** Operator UI language: auto follows the host locale; a manual override is zh-CN, en, or ru. */
export declare const LANGUAGE_PREFS: readonly ["auto", "zh-CN", "en", "ru"];
export type LanguagePref = (typeof LANGUAGE_PREFS)[number];
export declare const configSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    flavor: z.ZodEnum<{
        alibaba: "alibaba";
        bytedance: "bytedance";
        huawei: "huawei";
        tencent: "tencent";
        baidu: "baidu";
        pinduoduo: "pinduoduo";
        meituan: "meituan";
        jd: "jd";
        xiaomi: "xiaomi";
        netflix: "netflix";
        tesla: "tesla";
        apple: "apple";
        amazon: "amazon";
        microsoft: "microsoft";
        ding: "ding";
        auto: "auto";
    }>;
    mode: z.ZodEnum<{
        pua: "pua";
        p7: "p7";
        p9: "p9";
        p10: "p10";
        pro: "pro";
        yes: "yes";
        mama: "mama";
        shot: "shot";
        "pua-en": "pua-en";
        "pua-ja": "pua-ja";
    }>;
    language: z.ZodEnum<{
        auto: "auto";
        "zh-CN": "zh-CN";
        en: "en";
        ru: "ru";
    }>;
    subagents: z.ZodBoolean;
    terminalReview: z.ZodBoolean;
    failureCandidates: z.ZodBoolean;
    qualityTriggers: z.ZodBoolean;
    integrityGuard: z.ZodBoolean;
    offline: z.ZodBoolean;
    feedbackFrequency: z.ZodNumber;
    maxIterations: z.ZodNumber;
    verify: z.ZodString;
    verificationTimeout: z.ZodNumber;
}, z.core.$strict>;
export type Configuration = z.infer<typeof configSchema>;
export declare const patchSchema: z.ZodObject<{
    [x: string]: z.ZodOptional<z.ZodNullable<z.ZodBoolean>> | z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        alibaba: "alibaba";
        bytedance: "bytedance";
        huawei: "huawei";
        tencent: "tencent";
        baidu: "baidu";
        pinduoduo: "pinduoduo";
        meituan: "meituan";
        jd: "jd";
        xiaomi: "xiaomi";
        netflix: "netflix";
        tesla: "tesla";
        apple: "apple";
        amazon: "amazon";
        microsoft: "microsoft";
        ding: "ding";
        auto: "auto";
    }>>> | z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        pua: "pua";
        p7: "p7";
        p9: "p9";
        p10: "p10";
        pro: "pro";
        yes: "yes";
        mama: "mama";
        shot: "shot";
        "pua-en": "pua-en";
        "pua-ja": "pua-ja";
    }>>> | z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        auto: "auto";
        "zh-CN": "zh-CN";
        en: "en";
        ru: "ru";
    }>>> | z.ZodOptional<z.ZodNullable<z.ZodNumber>> | z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export type ConfigurationPatch = {
    [K in keyof Configuration]?: Configuration[K] | null;
};
export declare const CONFIG_DEFAULTS: Configuration;
export declare const CONFIG_KEYS: (keyof Configuration)[];
export declare const loopStartSchema: z.ZodObject<{
    task: z.ZodString;
    maxIterations: z.ZodNumber;
    verify: z.ZodString;
    verificationTimeout: z.ZodNumber;
}, z.core.$strict>;
export declare function parsePatch(value: unknown): ConfigurationPatch;
