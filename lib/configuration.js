import { z } from 'zod';
import { FLAVORS } from './flavors.js';
/** 全局默认与会话覆盖共用的参数契约；null 仅在覆盖补丁中表示恢复继承。 */
export const CONFIG_MODES = ['pua', 'p7', 'p9', 'p10', 'pro', 'yes', 'mama', 'shot', 'pua-en', 'pua-ja'];
/** 操作者界面语言：auto 跟随宿主 locale，手动覆盖为 zh-CN 或 en。 */
export const LANGUAGE_PREFS = ['auto', 'zh-CN', 'en'];
export const configSchema = z.object({
    enabled: z.boolean(),
    flavor: z.enum(['auto', ...FLAVORS.map(item => item.id)]),
    mode: z.enum(CONFIG_MODES),
    language: z.enum(LANGUAGE_PREFS),
    subagents: z.boolean(),
    terminalReview: z.boolean(),
    failureCandidates: z.boolean(),
    qualityTriggers: z.boolean(),
    integrityGuard: z.boolean(),
    offline: z.boolean(),
    feedbackFrequency: z.number().int().min(0).max(9999),
    maxIterations: z.number().int().min(0).max(10000),
    verify: z.string().max(8192),
    verificationTimeout: z.number().int().min(1).max(3600),
}).strict();
export const patchSchema = configSchema.partial().extend({
    ...Object.fromEntries(Object.entries(configSchema.shape).map(([key, schema]) => [key, schema.nullable().optional()])),
}).strict();
export const CONFIG_DEFAULTS = { enabled: true, flavor: 'auto', mode: 'pua', language: 'auto', subagents: false,
    terminalReview: true, failureCandidates: true, qualityTriggers: true, integrityGuard: false, offline: false,
    feedbackFrequency: 5, maxIterations: 0, verify: '', verificationTimeout: 120 };
export const CONFIG_KEYS = Object.keys(CONFIG_DEFAULTS);
export const loopStartSchema = z.object({ task: z.string().trim().min(1).max(4096), maxIterations: configSchema.shape.maxIterations,
    verify: configSchema.shape.verify, verificationTimeout: configSchema.shape.verificationTimeout }).strict();
export function parsePatch(value) {
    return patchSchema.parse(value);
}
//# sourceMappingURL=configuration.js.map