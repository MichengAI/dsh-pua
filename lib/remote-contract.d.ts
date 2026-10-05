import { z } from 'zod';
import type { InvocationDescriptor, RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import { type Configuration, type ConfigurationPatch } from './configuration.js';
export declare const snapshotSchema: z.ZodObject<{
    values: z.ZodObject<{
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
    defaults: z.ZodObject<{
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
    overrides: z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        flavor: z.ZodOptional<z.ZodEnum<{
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
        }>>;
        mode: z.ZodOptional<z.ZodEnum<{
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
        }>>;
        language: z.ZodOptional<z.ZodEnum<{
            auto: "auto";
            "zh-CN": "zh-CN";
            en: "en";
        }>>;
        subagents: z.ZodOptional<z.ZodBoolean>;
        terminalReview: z.ZodOptional<z.ZodBoolean>;
        failureCandidates: z.ZodOptional<z.ZodBoolean>;
        qualityTriggers: z.ZodOptional<z.ZodBoolean>;
        integrityGuard: z.ZodOptional<z.ZodBoolean>;
        offline: z.ZodOptional<z.ZodBoolean>;
        feedbackFrequency: z.ZodOptional<z.ZodNumber>;
        maxIterations: z.ZodOptional<z.ZodNumber>;
        verify: z.ZodOptional<z.ZodString>;
        verificationTimeout: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
    revision: z.ZodNumber;
    child: z.ZodBoolean;
}, z.core.$strip>;
export type ConfigurationSnapshot = z.infer<typeof snapshotSchema>;
export declare const activitySchema: z.ZodObject<{
    configuration: z.ZodObject<{
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
    }, z.core.$strict>;
    visible: z.ZodBoolean;
    verifying: z.ZodBoolean;
    failureCount: z.ZodNumber;
    loop: z.ZodNullable<z.ZodObject<{
        iteration: z.ZodNumber;
        maxIterations: z.ZodNumber;
        rejections: z.ZodNumber;
        verification: z.ZodEnum<{
            command: "command";
            model: "model";
        }>;
        verificationTimeout: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ActivitySnapshot = z.infer<typeof activitySchema>;
export interface PuaRemoteApi {
    getActivity(sessionId: string): Promise<RemoteResult<ActivitySnapshot>>;
    getGlobal(): Promise<RemoteResult<ConfigurationSnapshot>>;
    setGlobal(values: Configuration, revision: number): Promise<RemoteResult<ConfigurationSnapshot>>;
    getSession(sessionId: string): Promise<RemoteResult<ConfigurationSnapshot>>;
    setSession(sessionId: string, patch: ConfigurationPatch, revision: number): Promise<RemoteResult<ConfigurationSnapshot>>;
    startLoop(sessionId: string, task: string, values: Configuration): Promise<RemoteResult<{
        text: string;
    }>>;
    cancelLoop(sessionId: string): Promise<RemoteResult<{
        text: string;
    }>>;
}
export declare const DESCRIPTORS: InvocationDescriptor[];
export declare const TYPERT_REMOTE: TypertRemoteContribution;
