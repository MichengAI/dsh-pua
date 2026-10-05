import type { Configuration, LanguagePref } from './configuration.js';
/** 操作者可见界面文案的语言；模型侧 prompt 与服务端回复不在本地化范围。 */
export type UiLang = 'zh' | 'en';
type ConfigKey = keyof Configuration;
/** 手动覆盖时才与宿主 locale 解耦；auto 表示跟随宿主。 */
export declare function resolveUiLang(pref: LanguagePref | undefined, hostLocale: string | undefined): UiLang;
type Lookup = {
    get?(name: string): unknown;
};
/** 读取宿主 locale 服务当前 active 值；缺失或形态不符时返回 undefined。 */
export declare function hostLocaleOf(lookup: Lookup): string | undefined;
/** 风味显示名；en 无映射或 zh 未登记时回退原 id。 */
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
/** 斜杠菜单行。宿主命令注册表只接受普通字符串，菜单文案在每次生成候选项时按界面语言覆盖。 */
export interface SlashCommandCopy {
    label: string;
    description: string;
    hint?: string;
}
export interface UiCopy {
    settingsSummary: string;
    cardTitle: string;
    cardToggle: (open: boolean) => string;
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
