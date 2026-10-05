import { z } from 'zod';
/** 全局默认与会话覆盖共用的参数契约；null 仅在覆盖补丁中表示恢复继承。 */
export declare const CONFIG_MODES: readonly ["pua", "p7", "p9", "p10", "pro", "yes", "mama", "shot", "pua-en", "pua-ja"];
/** 操作者界面语言：auto 跟随宿主 locale，手动覆盖为 zh-CN 或 en。 */
export declare const LANGUAGE_PREFS: readonly ["auto", "zh-CN", "en"];
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
