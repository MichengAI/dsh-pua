import Schema from '@deepseek-ai/schemastery';
import { FLAVORS } from './flavors.js';
import { CONFIG_DEFAULTS, CONFIG_MODES, LANGUAGE_PREFS } from './configuration.js';
export const SETTINGS_NAMESPACE = 'phucnd0604-pua-en';
function preferenceFields() {
    return {
        alwaysOn: Schema.boolean().default(true).description('Allow /pua and the chat entry point. When off, the command and the entry point are hidden, and the current session cannot turn them on either. Nothing is injected automatically.'),
        flavor: Schema.union(['auto', ...FLAVORS.map(item => item.id)].map(value => Schema.const(value))).default('auto').description('Default flavor; auto routes by task as in the original, while a named flavor stays locked.'),
        offline: Schema.boolean().default(false).description('Offline mode: disables voluntary feedback reminders. This port never includes network refresh or reporting.'),
        feedbackFrequency: Schema.number().min(0).max(9999).step(1).default(5).description('Show the local feedback entry point every N deliverables that have PUA-visible output; 0 disables it. Ratings are never recorded automatically.'),
        mode: Schema.union(CONFIG_MODES.map(value => Schema.const(value))).default('pua').description('Default persona mode.'),
        language: Schema.union(LANGUAGE_PREFS.map(value => Schema.const(value))).default('auto').description('UI language: auto follows the host; it can be pinned to Chinese, English, or Russian.'),
        subagents: Schema.boolean().default(false).description('Enable PUA for subagents; they use the parent session\'s effective configuration and inherit neither the Loop nor the failure count.'),
        terminalReview: Schema.boolean().default(true).description('Reminder to verify abnormal terminal text.'),
        failureCandidates: Schema.boolean().default(true).description('Hints about escalation candidates after a failure; the failure itself still has to be verified.'),
        qualityTriggers: Schema.boolean().default(true).description('Quality course-correction hints when the user is unhappy or asks for evidence.'),
        integrityGuard: Schema.boolean().default(false).description('Anti-cheat gate, off by default. When on, it blocks benchmark-polluting targets and injects a reminder into the model when tests, scores, or CI assets change.'),
        maxIterations: Schema.number().min(0).max(10000).step(1).default(0).description('Default iteration cap for the Loop; 0 means unlimited. Saving does not start a loop.'),
        verify: Schema.string().max(8192).default('').description('Default verification command; when blank, the model report is used. It can be changed per project at launch time.'),
        verificationTimeout: Schema.number().min(1).max(3600).step(1).default(120).description('Independent verification timeout in seconds; a Loop that has already started does not follow later setting changes.'),
    };
}
/** Reduces the field declarations to a plain schema that can still be validated. Since 0.2.0 schemastery provides volatile(). */
export const SETTINGS_SCHEMA = Schema.object(preferenceFields());
export const Config = SETTINGS_SCHEMA.volatile();
function unwrap(value) {
    if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
        return value.get();
    }
    return value;
}
/** Reduces a plain object or a volatile reference to setting values. Missing fields fall back to the schema defaults. */
export function materializePreferences(config) {
    const root = unwrap(config);
    if (!root || typeof root !== 'object')
        return undefined;
    const plain = Object.fromEntries(Object.entries(root).map(([key, value]) => [key, unwrap(value)]));
    try {
        return SETTINGS_SCHEMA(plain);
    }
    catch {
        return undefined;
    }
}
/** Optional settings service. Since 0.2.0 it reads the volatile configuration in the Profile; without that service, changes only affect the current session. */
export class PreferencesBridge {
    config;
    ready = false;
    constructor(ctx, config) {
        this.config = config;
        ctx.inject(['settings'], child => {
            const settings = child.settings;
            this.ready = true;
            if (typeof settings.configure === 'function') {
                const dispose = settings.configure({ auto: false }, ctx.fiber);
                child.effect(() => dispose);
            }
        });
    }
    current() {
        if (!this.ready)
            return undefined;
        return materializePreferences(this.config);
    }
    defaults() {
        const config = this.current();
        if (!config)
            return {};
        const inherited = Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'alwaysOn'));
        return { ...inherited, flavor: config.flavor === 'auto' ? 'alibaba' : config.flavor, flavorLocked: config.flavor !== 'auto' };
    }
    configuration() {
        const config = this.current();
        if (!config)
            return { ...CONFIG_DEFAULTS, enabled: false };
        const { alwaysOn, ...rest } = config;
        return { ...rest, enabled: alwaysOn };
    }
    /** Returns the global switch when a settings service exists; undefined when none does, in which case session commands still work. */
    globallyEnabled() {
        const config = this.current();
        return config ? config.alwaysOn : undefined;
    }
    description() { return this.current() ? 'Current session only; to change the global switch, turn on "Allow PUA" under Plugins first' : 'Current session only (the host provides no settings)'; }
    feedback() {
        const config = this.current();
        return { offline: config?.offline ?? false, frequency: config?.feedbackFrequency ?? 5 };
    }
}
//# sourceMappingURL=settings.js.map