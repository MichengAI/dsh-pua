import { z } from 'zod';
import type { InvocationDescriptor, RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import { configSchema, patchSchema, type Configuration, type ConfigurationPatch } from './configuration.js';

export const snapshotSchema = z.object({ values: configSchema, defaults: configSchema, overrides: configSchema.partial(), revision: z.number().int(), child: z.boolean() });
export type ConfigurationSnapshot = z.infer<typeof snapshotSchema>;
export const activitySchema = z.object({
  configuration: configSchema.pick({ mode: true, flavor: true, subagents: true }),
  visible: z.boolean(), verifying: z.boolean(), failureCount: z.number().int().nonnegative(),
  loop: z.object({ iteration: z.number().int(), maxIterations: z.number().int(), rejections: z.number().int(), verification: z.enum(['command', 'model']), verificationTimeout: z.number().int().positive() }).nullable(),
});
export type ActivitySnapshot = z.infer<typeof activitySchema>;
export interface PuaRemoteApi {
  getActivity(sessionId: string): Promise<RemoteResult<ActivitySnapshot>>;
  getGlobal(): Promise<RemoteResult<ConfigurationSnapshot>>;
  setGlobal(values: Configuration, revision: number): Promise<RemoteResult<ConfigurationSnapshot>>;
  getSession(sessionId: string): Promise<RemoteResult<ConfigurationSnapshot>>;
  setSession(sessionId: string, patch: ConfigurationPatch, revision: number): Promise<RemoteResult<ConfigurationSnapshot>>;
  startLoop(sessionId: string, task: string, values: Configuration): Promise<RemoteResult<{ text: string }>>;
  cancelLoop(sessionId: string): Promise<RemoteResult<{ text: string }>>;
}
const parameter = (name: string, schema: z.ZodType): InvocationDescriptor['parameters'][number] => ({ name, wire: name, source: 'json', codec: { mode: 'strict', typeSymbol: name, schema } });
const session = parameter('sessionId', z.string().min(1).max(256));
const revision = parameter('revision', z.number().int().min(0));
const methods: [string, InvocationDescriptor['parameters'], z.ZodType][] = [
  ['getActivity', [session], activitySchema],
  ['getGlobal', [], snapshotSchema],
  ['setGlobal', [parameter('values', configSchema), revision], snapshotSchema],
  ['getSession', [session], snapshotSchema],
  ['setSession', [session, parameter('patch', patchSchema), revision], snapshotSchema],
  ['startLoop', [session, parameter('task', z.string().trim().min(1).max(4096)), parameter('values', configSchema)], z.object({ text: z.string() })],
  ['cancelLoop', [session], z.object({ text: z.string() })],
];
export const DESCRIPTORS: InvocationDescriptor[] = methods.map(([method, parameters, schema]) => ({
  id: `@michengai/dsh-pua#puaConfig/${method}`, namespace: 'puaConfig', service: 'puaConfig', method,
  invocation: { kind: 'direct' }, parameters, result: { mode: 'strict', typeSymbol: 'PuaConfiguration', schema },
}));
export const TYPERT_REMOTE: TypertRemoteContribution = { package: '@michengai/dsh-pua', descriptors: DESCRIPTORS };
