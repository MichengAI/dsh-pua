import { z } from 'zod';
import { configSchema, patchSchema } from './configuration.js';
export const snapshotSchema = z.object({ values: configSchema, defaults: configSchema, overrides: configSchema.partial(), revision: z.number().int(), child: z.boolean() });
export const activitySchema = z.object({
    configuration: configSchema.pick({ mode: true, flavor: true, subagents: true, language: true }),
    visible: z.boolean(), verifying: z.boolean(), failureCount: z.number().int().nonnegative(),
    loop: z.object({ iteration: z.number().int(), maxIterations: z.number().int(), rejections: z.number().int(), verification: z.enum(['command', 'model']), verificationTimeout: z.number().int().positive() }).nullable(),
});
/** Since 0.2.0 the Registry takes the boundary schema through create(). */
function strictCodec(typeSymbol, schema) {
    return { mode: 'strict', typeSymbol, create: () => schema };
}
const parameter = (name, schema) => ({ name, wire: name, source: 'json', codec: strictCodec(name, schema) });
const session = parameter('sessionId', z.string().min(1).max(256));
const revision = parameter('revision', z.number().int().min(0));
const methods = [
    ['getActivity', [session], activitySchema],
    ['getGlobal', [], snapshotSchema],
    ['setGlobal', [parameter('values', configSchema), revision], snapshotSchema],
    ['getSession', [session], snapshotSchema],
    ['setSession', [session, parameter('patch', patchSchema), revision], snapshotSchema],
    ['startLoop', [session, parameter('task', z.string().trim().min(1).max(4096)), parameter('values', configSchema)], z.object({ text: z.string() })],
    ['cancelLoop', [session], z.object({ text: z.string() })],
];
export const DESCRIPTORS = methods.map(([method, parameters, schema]) => ({
    id: `@phucnd0604/dsh-pua-en#puaConfig/${method}`, namespace: 'puaConfig', service: 'puaConfig', method,
    invocation: { kind: 'direct' }, parameters, result: strictCodec('PuaConfiguration', schema),
}));
export const TYPERT_REMOTE = { package: '@phucnd0604/dsh-pua-en', descriptors: DESCRIPTORS };
//# sourceMappingURL=remote-contract.js.map