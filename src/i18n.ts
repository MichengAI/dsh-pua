import { FLAVORS } from './flavors.js';
import type { Configuration, LanguagePref } from './configuration.js';

/** 操作者可见界面文案的语言；模型侧 prompt 与服务端回复不在本地化范围。 */
export type UiLang = 'zh' | 'en';

type ConfigKey = keyof Configuration;

/** 手动覆盖时才与宿主 locale 解耦；auto 表示跟随宿主。 */
export function resolveUiLang(pref: LanguagePref | undefined, hostLocale: string | undefined): UiLang {
  if (pref === 'en') return 'en';
  if (pref === 'zh-CN') return 'zh';
  return typeof hostLocale === 'string' && /^en(?:[-_]|$)/i.test(hostLocale) ? 'en' : 'zh';
}

type Lookup = { get?(name: string): unknown };

/** 读取宿主 locale 服务当前 active 值；缺失或形态不符时返回 undefined。 */
export function hostLocaleOf(lookup: Lookup): string | undefined {
  const locale = lookup.get?.('locale') as { snapshot?: { active?: unknown } } | undefined;
  const active = locale?.snapshot?.active;
  return typeof active === 'string' ? active : undefined;
}

const EN_FLAVOR_LABELS: Record<string, string> = {
  alibaba: 'Alibaba', bytedance: 'ByteDance', huawei: 'Huawei', tencent: 'Tencent', baidu: 'Baidu',
  pinduoduo: 'Pinduoduo', meituan: 'Meituan', jd: 'JD', xiaomi: 'Xiaomi', netflix: 'Netflix',
  tesla: 'Tesla (Musk)', apple: 'Apple (Jobs)', amazon: 'Amazon', microsoft: 'Microsoft', ding: 'DingTalk',
};

/** 风味显示名；en 无映射或 zh 未登记时回退原 id。 */
export function flavorLabel(id: string, lang: UiLang): string {
  if (lang === 'en') return EN_FLAVOR_LABELS[id] ?? id;
  return FLAVORS.find(item => item.id === id)?.label ?? id;
}

export interface LoopCopy {
  summary: string; note: string; task: string; verify: string; iterations: string; timeout: string; start: string; cancel: string;
}

export interface PanelCopy {
  globalAria: string; sessionAria: string; sessionHeading: string;
  globalNote: string; sessionNote: (overridden: number) => string;
  restoreAll: string; childNote: string; reload: string;
  statusLoading: string; statusSynced: string; statusSaving: string; statusSaved: string;
  statusSavedSession: string; statusNotSaved: string; statusDirty: string;
  overrideBadge: string; restoreDefault: string; restoreDefaultAria: (label: string) => string;
  detailsSummary: string; discard: string; save: string; saveBusy: string;
  loop: LoopCopy;
}

export interface ComposerCopy {
  readingAria: string; offAria: string; onAria: string;
  readingTitle: string; offTitle: string; onTitle: string;
  dialogAria: string; closePanel: string; close: string; readError: string;
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
    fallback: string; invalid: string;
    tooBig: (max: number) => string; tooSmall: (min: number) => string;
    join: string; fieldFallback: string;
  };
  panel: PanelCopy;
  composer: ComposerCopy;
}

export const UI: Record<UiLang, UiCopy> = {
  zh: {
    settingsSummary: '全局默认、角色风味与子代理策略。',
    cardTitle: 'PUA 配置',
    cardToggle: open => `${open ? '收起' : '展开'}：PUA 配置`,
    fields: {
      enabled: '开启 PUA', flavor: '风味', mode: '角色模式', subagents: '对子代理启用 PUA',
      terminalReview: '终端异常核验提醒', failureCandidates: '失败升级候选提示', qualityTriggers: '质量纠偏提示',
      integrityGuard: '防作弊门',
      offline: '反馈提醒', feedbackFrequency: '反馈提醒频率', maxIterations: 'Loop 轮次上限', verify: '默认验收命令', verificationTimeout: '验收超时（秒）',
      language: '界面语言',
    },
    languageChoices: { auto: '自动（跟随宿主）', 'zh-CN': '中文', en: 'English' },
    autoFlavor: '自动选味',
    descriptions: {
      subagents: '默认关闭，避免干扰专家插件。开启后继承父会话生效配置，不继承循环或失败计数。',
      maxIterations: '0 表示不限轮次。保存配置不会启动 Loop。',
      verify: '留空使用模型报告，不代表独立验收通过。命令在会话工作目录执行，启动时可修改。',
      verificationTimeout: '已启动的 Loop 保持启动时确认的参数。',
      feedbackFrequency: '每多少次有 PUA 可见输出的交付提醒一次，0 关闭。插件不上传反馈。',
      language: 'auto 跟随宿主界面语言。',
      integrityGuard: '默认关闭。开启后拦截隐藏基准答案，变更测试、评分或 CI 资产时向模型注入提醒。',
    },
    validation: {
      fallback: '保存失败，请重试。', invalid: '的值无效，请检查输入',
      tooBig: max => '不能超过 ' + max, tooSmall: min => '不能小于 ' + min,
      join: '；', fieldFallback: '配置',
    },
    panel: {
      globalAria: 'PUA 全局配置', sessionAria: 'PUA 会话配置', sessionHeading: '当前会话 PUA',
      globalNote: '保存为当前 DSH profile 的全局默认；已有会话自定义项保持不变。',
      sessionNote: n => `仅影响当前会话 · 已自定义 ${n} 项。全局默认只能在「插件」里打开 PUA 后修改。`,
      restoreAll: '恢复全部继承',
      childNote: '子代理的未覆盖项继承父会话生效值；父会话关闭或不允许对子代理启用时，本会话不能强制开启。',
      reload: '重新读取配置',
      statusLoading: '正在读取配置…', statusSynced: '配置已同步', statusSaving: '正在保存…',
      statusSaved: '已保存 · 从下一模型步骤生效',
      statusSavedSession: '已保存；实际开关受父会话与子代理策略限制，请以下方状态为准',
      statusNotSaved: '未保存', statusDirty: '有未保存的修改',
      overrideBadge: '已自定义', restoreDefault: '恢复默认', restoreDefaultAria: label => `恢复${label}默认值`,
      detailsSummary: '提醒与 Loop 默认参数', discard: '放弃修改', save: '保存', saveBusy: '保存中…',
      loop: {
        summary: '启动或取消 Loop', note: '下方参数只用于本次启动，不修改默认设置。',
        task: '任务', verify: '本次验收命令（留空使用模型报告）',
        iterations: '本次轮次上限（0 不限）', timeout: '本次验收超时（秒）',
        start: '启动 Loop', cancel: '取消当前 Loop',
      },
    },
    composer: {
      readingAria: 'PUA（正在读取会话配置）', offAria: 'PUA（当前会话已关闭）', onAria: 'PUA（当前会话已开启）',
      readingTitle: '正在读取会话配置', offTitle: 'PUA 已关闭，点击配置', onTitle: 'PUA 已开启，点击配置',
      dialogAria: '当前会话 PUA 配置', closePanel: '关闭配置面板', close: '关闭',
      readError: '无法读取全局配置，请检查连接或打开插件配置页重试。',
    },
  },
  en: {
    settingsSummary: 'Global defaults, persona flavor, and subagent policy.',
    cardTitle: 'PUA settings',
    cardToggle: open => `${open ? 'Collapse' : 'Expand'}: PUA settings`,
    fields: {
      enabled: 'Enable PUA', flavor: 'Persona flavor', mode: 'Role mode', subagents: 'Enable for subagents',
      terminalReview: 'Terminal anomaly review reminders', failureCandidates: 'Failure escalation hints', qualityTriggers: 'Quality correction prompts',
      integrityGuard: 'Integrity guard',
      offline: 'Feedback reminders', feedbackFrequency: 'Feedback reminder frequency', maxIterations: 'Loop iteration cap', verify: 'Default verify command', verificationTimeout: 'Verify timeout (s)',
      language: 'UI language',
    },
    languageChoices: { auto: 'Auto (follow host)', 'zh-CN': 'Chinese', en: 'English' },
    autoFlavor: 'Auto',
    descriptions: {
      subagents: 'Off by default to avoid interfering with expert plugins. When enabled, subagents inherit the parent session\'s effective config, not loops or failure counts.',
      maxIterations: '0 means unlimited. Saving settings does not start a loop.',
      verify: 'Leave empty to use the model report, which is not an independent check. The command runs in the session working directory and can be changed at loop start.',
      verificationTimeout: 'Running loops keep the parameters confirmed at start.',
      feedbackFrequency: 'Remind once every N delivered outputs with visible PUA activity; 0 disables. Nothing is uploaded.',
      language: 'auto follows the host UI language.',
      integrityGuard: 'Off by default. When on, deny hidden benchmark answers and remind when edits touch test, scoring, or CI assets.',
    },
    validation: {
      fallback: 'Save failed, please retry.', invalid: ' has an invalid value',
      tooBig: max => ' cannot exceed ' + max, tooSmall: min => ' cannot be less than ' + min,
      join: '; ', fieldFallback: 'Settings',
    },
    panel: {
      globalAria: 'PUA global settings', sessionAria: 'PUA session settings', sessionHeading: 'PUA for this session',
      globalNote: 'Saved as global defaults for the current DSH profile; existing session overrides are kept.',
      sessionNote: n => `Affects this session only · ${n} overridden. Global defaults can only be changed from Plugins after enabling PUA.`,
      restoreAll: 'Restore all inheritance',
      childNote: 'A subagent inherits the parent session for keys it has not overridden; when the parent session is off or disallows subagents, this session cannot force enablement.',
      reload: 'Reload settings',
      statusLoading: 'Loading settings…', statusSynced: 'Settings synced', statusSaving: 'Saving…',
      statusSaved: 'Saved · takes effect from the next model step',
      statusSavedSession: 'Saved; the actual switch is constrained by the parent session and subagent policy — see the status below',
      statusNotSaved: 'Not saved', statusDirty: 'Unsaved changes',
      overrideBadge: 'Overridden', restoreDefault: 'Restore default', restoreDefaultAria: label => `Restore default ${label}`,
      detailsSummary: 'Reminders and loop defaults', discard: 'Discard', save: 'Save', saveBusy: 'Saving…',
      loop: {
        summary: 'Start or cancel a loop', note: 'These parameters apply to this start only; defaults are unchanged.',
        task: 'Task', verify: 'Verify command for this run (empty uses the model report)',
        iterations: 'Iteration cap for this run (0 = unlimited)', timeout: 'Verify timeout for this run (s)',
        start: 'Start loop', cancel: 'Cancel current loop',
      },
    },
    composer: {
      readingAria: 'PUA (loading session settings)', offAria: 'PUA (off for this session)', onAria: 'PUA (on for this session)',
      readingTitle: 'Loading session settings', offTitle: 'PUA is off — click to configure', onTitle: 'PUA is on — click to configure',
      dialogAria: 'PUA settings for this session', closePanel: 'Close settings panel', close: 'Close',
      readError: 'Could not read global settings. Check the connection or open the plugin settings page and retry.',
    },
  },
};

export interface ActivityCopy {
  ariaLabel: string;
  statusVerifying: string; statusLoop: string; statusTask: string;
  iteration: (current: number, max: number) => string;
  fields: { mode: string; flavor: string; subagents: string; loopIterations: string; verification: string; timeout: string; failures: string; rejections: string };
  on: string; off: string; auto: string; unlimited: string; byCommand: string; byModel: string;
  seconds: (t: number) => string; timeoutNA: string; times: (n: number) => string;
  toggle: (open: boolean) => string; cancelBusy: string; cancel: string; cancelFailed: string;
}

export const ACTIVITY: Record<UiLang, ActivityCopy> = {
  zh: {
    ariaLabel: 'PUA 运行状态',
    statusVerifying: '正在验收', statusLoop: 'Loop 运行中', statusTask: '任务执行中',
    iteration: (current, max) => `第 ${current} 轮${max > 0 ? ` / ${max} 轮` : ''}`,
    fields: { mode: '角色模式', flavor: '风味', subagents: '对子代理启用', loopIterations: 'Loop 轮次', verification: '验收方式', timeout: '验收超时', failures: '连续终端失败观察', rejections: '验收未通过' },
    on: '开启', off: '关闭', auto: '自动', unlimited: '不限', byCommand: '独立验收命令', byModel: '模型报告',
    seconds: t => `${t} 秒`, timeoutNA: '不适用', times: n => `${n} 次`,
    toggle: open => (open ? '收起' : '展开'), cancelBusy: '正在取消…', cancel: '取消 Loop', cancelFailed: '取消失败，请重试。',
  },
  en: {
    ariaLabel: 'PUA activity',
    statusVerifying: 'Verifying', statusLoop: 'Loop running', statusTask: 'Task running',
    iteration: (current, max) => `Round ${current}${max > 0 ? ` of ${max}` : ''}`,
    fields: { mode: 'Role mode', flavor: 'Flavor', subagents: 'Subagents', loopIterations: 'Loop iterations', verification: 'Verification', timeout: 'Verify timeout', failures: 'Terminal failures', rejections: 'Rejected checks' },
    on: 'On', off: 'Off', auto: 'Auto', unlimited: 'unlimited', byCommand: 'Verify command', byModel: 'Model report',
    seconds: t => `${t} s`, timeoutNA: 'N/A', times: n => String(n),
    toggle: open => (open ? 'Collapse' : 'Expand'), cancelBusy: 'Canceling…', cancel: 'Cancel loop', cancelFailed: 'Failed to cancel, please retry.',
  },
};
