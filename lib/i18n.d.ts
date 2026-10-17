import type { Configuration, LanguagePref } from './configuration.js';
/** Language of operator-visible UI copy; model-side prompts and server replies are outside the scope of localization. */
export type UiLang = 'zh' | 'en' | 'ru';
type ConfigKey = keyof Configuration;
/** Decoupled from the host locale only when manually overridden; auto means follow the host. */
export declare function resolveUiLang(pref: LanguagePref | undefined, hostLocale: string | undefined): UiLang;
type Lookup = {
    get?(name: string): unknown;
};
/** Reads the host locale service's current active value; returns undefined when it is missing or malformed. */
export declare function hostLocaleOf(lookup: Lookup): string | undefined;
/** Flavor display name; falls back to the raw id when en/ru have no mapping or zh has no entry. */
export declare function flavorLabel(id: string, lang: UiLang): string;
export interface LoopCopy {
    summary: string;
    note: string;
    task: string;
    verify: string;
    iterations: string;
    timeout: string;
    start: string;
    cancel: string;
}
export interface PanelCopy {
    globalAria: string;
    sessionAria: string;
    sessionHeading: string;
    globalNote: string;
    sessionNote: (overridden: number) => string;
    restoreAll: string;
    childNote: string;
    reload: string;
    statusLoading: string;
    statusSynced: string;
    statusSaving: string;
    statusSaved: string;
    statusSavedSession: string;
    statusNotSaved: string;
    statusDirty: string;
    overrideBadge: string;
    restoreDefault: string;
    restoreDefaultAria: (label: string) => string;
    detailsSummary: string;
    discard: string;
    save: string;
    saveBusy: string;
    loop: LoopCopy;
}
export interface ComposerCopy {
    readingAria: string;
    offAria: string;
    onAria: string;
    readingTitle: string;
    offTitle: string;
    onTitle: string;
    dialogAria: string;
    closePanel: string;
    close: string;
    readError: string;
}
/** Slash menu row. The host command registry accepts only plain strings, so menu copy is overridden per UI language every time candidates are generated. */
export interface SlashCommandCopy {
    label: string;
    description: string;
    hint?: string;
}
export interface UiCopy {
    settingsSummary: string;
    cardTitle: string;
    cardToggle: (open: boolean) => string;
    /** The global switch only controls the command and chat entry; it does not mean the session has been injected. */
    allow: {
        label: string;
        description: string;
    };
    fields: Record<ConfigKey, string>;
    languageChoices: Record<LanguagePref, string>;
    autoFlavor: string;
    descriptions: Partial<Record<ConfigKey, string>>;
    validation: {
        fallback: string;
        invalid: string;
        tooBig: (max: number) => string;
        tooSmall: (min: number) => string;
        join: string;
        fieldFallback: string;
    };
    panel: PanelCopy;
    composer: ComposerCopy;
    slash: {
        pua: SlashCommandCopy & {
            hint: string;
        };
        cancelLoop: SlashCommandCopy;
    };
}
export declare const UI: Record<UiLang, UiCopy>;
export interface ActivityCopy {
    ariaLabel: string;
    statusVerifying: string;
    statusLoop: string;
    statusTask: string;
    iteration: (current: number, max: number) => string;
    fields: {
        mode: string;
        flavor: string;
        subagents: string;
        loopIterations: string;
        verification: string;
        timeout: string;
        failures: string;
        rejections: string;
    };
    on: string;
    off: string;
    auto: string;
    unlimited: string;
    byCommand: string;
    byModel: string;
    seconds: (t: number) => string;
    timeoutNA: string;
    times: (n: number) => string;
    toggle: (open: boolean) => string;
    cancelBusy: string;
    cancel: string;
    cancelFailed: string;
}
export declare const ACTIVITY: Record<UiLang, ActivityCopy>;
export {};
