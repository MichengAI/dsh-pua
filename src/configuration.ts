import { z } from 'zod';
import { FLAVORS } from './flavors.js';

/** 全局默认与会话覆盖共用的参数契约；null 仅在覆盖补丁中表示恢复继承。 */
export const CONFIG_MODES = ['pua', 'p7', 'p9', 'p10', 'pro', 'yes', 'mama', 'shot', 'pua-en', 'pua-ja'] as const;
export const configSchema = z.object({
  enabled: z.boolean(),
  flavor: z.enum(['auto', ...FLAVORS.map(item => item.id)]),
  mode: z.enum(CONFIG_MODES),
  subagents: z.boolean(),
  terminalReview: z.boolean(),
  failureCandidates: z.boolean(),
  qualityTriggers: z.boolean(),
  offline: z.boolean(),
  feedbackFrequency: z.number().int().min(0).max(9999),
  maxIterations: z.number().int().min(0).max(10000),
  verify: z.string().max(8192),
  verificationTimeout: z.number().int().min(1).max(3600),
}).strict();
export type Configuration = z.infer<typeof configSchema>;
export const patchSchema = configSchema.partial().extend({
  ...Object.fromEntries(Object.entries(configSchema.shape).map(([key, schema]) => [key, schema.nullable().optional()])),
}).strict();
export type ConfigurationPatch = { [K in keyof Configuration]?: Configuration[K] | null };
export const CONFIG_DEFAULTS: Configuration = { enabled: true, flavor: 'auto', mode: 'pua', subagents: false,
  terminalReview: true, failureCandidates: true, qualityTriggers: true, offline: false,
  feedbackFrequency: 5, maxIterations: 0, verify: '', verificationTimeout: 120 };
export const CONFIG_KEYS = Object.keys(CONFIG_DEFAULTS) as (keyof Configuration)[];
export const loopStartSchema = z.object({ task: z.string().trim().min(1).max(4096), maxIterations: configSchema.shape.maxIterations,
  verify: configSchema.shape.verify, verificationTimeout: configSchema.shape.verificationTimeout }).strict();
export function parsePatch(value: unknown): ConfigurationPatch {
  return patchSchema.parse(value) as ConfigurationPatch;
}
