import { type FlavorId } from './flavors.js';
import { type PuaMode } from './content.js';
import { type ConfigurationPatch } from './configuration.js';
export type Action = {
    readonly kind: 'configure';
    readonly patch: ConfigurationPatch;
} | {
    readonly kind: 'activate' | 'review';
    readonly task: string;
} | {
    readonly kind: 'flavor';
    readonly flavor: FlavorId | 'auto';
} | {
    readonly kind: 'mode';
    readonly mode: PuaMode;
    readonly task: string;
} | {
    readonly kind: 'loop';
    readonly task: string;
    readonly maxIterations: number;
    readonly verify?: string;
    readonly verificationTimeout?: number;
} | {
    readonly kind: 'again' | 'done-check' | 'evidence' | 'kpi' | 'survey';
    readonly task?: string;
} | {
    readonly kind: 'on' | 'off' | 'offline' | 'status' | 'help' | 'flavors' | 'cancel-pua-loop' | 'team-status' | 'reap-orphans' | 'teardown-all';
};
/** Parses the text after /pua; plain commands are capped at 8 KiB; structured configuration keeps the 128 KiB transport cap and is validated field by field. */
export declare function parseArgs(raw: string, loopDefaults?: {
    maxIterations: number;
    verify: string;
    verificationTimeout: number;
}): Action;
