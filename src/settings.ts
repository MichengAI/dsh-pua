import type { Context, Fiber } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-settings';
import Schema from '@deepseek-ai/schemastery';
import { FLAVORS } from './flavors.js';
import type { PuaState } from './state.js';
import { CONFIG_DEFAULTS, CONFIG_MODES, LANGUAGE_PREFS, type Configuration } from './configuration.js';
import { hostLocaleOf, resolveUiLang } from './i18n.js';
import { serverCopy, setServerLang } from './server-copy.js';

export interface Preferences extends Omit<Configuration, 'enabled'> { alwaysOn: boolean }
export const SETTINGS_NAMESPACE = 'michengai-pua';

/** 设置页字段说明；中文是既有原文，英文供宿主按 locale 解析。 */
const FIELD_TEXT: Record<string, { zh: string; en: string }> = {
  alwaysOn: { zh: '默认开启 PUA（与原版一致）；会话内显式 on/off 优先。',
    en: 'Turn PUA on by default (same as the original); an explicit on/off in a session takes priority.' },
  flavor: { zh: '默认风味；auto 按原版任务路由，指定风味则锁定。',
    en: 'Default flavor; auto routes by task as in the original, a named flavor locks it.' },
  offline: { zh: '离线模式：关闭自愿反馈提醒。本移植始终不包含联网刷新或上报能力。',
    en: 'Offline mode: turns off the voluntary feedback prompt. This port never includes network refresh or reporting.' },
  feedbackFrequency: { zh: '每多少次有 PUA 可见输出的交付显示本地反馈入口；0 关闭，不自动记录评分。',
    en: 'Show the local feedback prompt every N deliverables with visible PUA output; 0 turns it off and never records a score.' },
  mode: { zh: '默认角色模式。', en: 'Default role mode.' },
  language: { zh: '界面语言：auto 跟随宿主，可固定为中文或 English。',
    en: 'Interface language: auto follows the host; can be pinned to Chinese or English.' },
  subagents: { zh: '对子代理启用 PUA；使用父会话生效配置，不继承 Loop 和失败计数。',
    en: 'Enable PUA for subagents; they use the parent session configuration and inherit neither the Loop nor the failure count.' },
  terminalReview: { zh: '终端异常文本核验提醒。',
    en: 'Reminder to review terminal text that looks like a failure.' },
  failureCandidates: { zh: '失败后的升级候选提示，仍须核验任务失败。',
    en: 'Escalation-candidate hints after a failure; the task failure itself still has to be verified.' },
  qualityTriggers: { zh: '用户不满或要求证据时的质量纠偏提示。',
    en: 'Quality-correction hints for when the user is dissatisfied or asks for evidence.' },
  integrityGuard: { zh: '防作弊门，默认关闭。开启后拦截基准污染目标，变更测试、评分或 CI 资产时向模型注入提醒。',
    en: 'Anti-cheat gate, off by default. When on it blocks benchmark-poisoning goals and injects a reminder whenever tests, scoring, or CI assets change.' },
  maxIterations: { zh: 'Loop 默认轮次上限；0 不限。保存不启动循环。',
    en: 'Default Loop iteration cap; 0 means unlimited. Saving does not start a loop.' },
  verify: { zh: '默认验收命令；空白使用模型报告。启动时可按项目修改。',
    en: 'Default verification command; blank falls back to the model report. Can be changed per project at start.' },
  verificationTimeout: { zh: '独立验收超时（秒），已启动 Loop 不随设置变化。',
    en: 'Independent verification timeout in seconds; a Loop that already started does not follow later changes.' },
};

/** 同一份字段说明按 locale 注入；宿主按 locale 解析，缺省回落到英文。 */
function preferenceSchema() {
  const fields = preferenceFields();
  return Schema.object(fields).i18n({
    zh: Object.fromEntries(Object.entries(FIELD_TEXT).map(([key, text]) => [key, text.zh])),
    en: Object.fromEntries(Object.entries(FIELD_TEXT).map(([key, text]) => [key, text.en])),
  });
}
function preferenceFields() {
  return {
    alwaysOn: Schema.boolean().default(true).description('默认开启 PUA（与原版一致）；会话内显式 on/off 优先。'),
    flavor: Schema.union((['auto', ...FLAVORS.map(item => item.id)] as const).map(value => Schema.const(value))).default('auto').description('默认风味；auto 按原版任务路由，指定风味则锁定。'),
    offline: Schema.boolean().default(false).description('离线模式：关闭自愿反馈提醒。本移植始终不包含联网刷新或上报能力。'),
    feedbackFrequency: Schema.number().min(0).max(9999).step(1).default(5).description('每多少次有 PUA 可见输出的交付显示本地反馈入口；0 关闭，不自动记录评分。'),
    mode: Schema.union(CONFIG_MODES.map(value => Schema.const(value))).default('pua').description('默认角色模式。'),
    language: Schema.union(LANGUAGE_PREFS.map(value => Schema.const(value))).default('auto').description('界面语言：auto 跟随宿主，可固定为中文或 English。'),
    subagents: Schema.boolean().default(false).description('对子代理启用 PUA；使用父会话生效配置，不继承 Loop 和失败计数。'),
    terminalReview: Schema.boolean().default(true).description('终端异常文本核验提醒。'),
    failureCandidates: Schema.boolean().default(true).description('失败后的升级候选提示，仍须核验任务失败。'),
    qualityTriggers: Schema.boolean().default(true).description('用户不满或要求证据时的质量纠偏提示。'),
    integrityGuard: Schema.boolean().default(false).description('防作弊门，默认关闭。开启后拦截基准污染目标，变更测试、评分或 CI 资产时向模型注入提醒。'),
    maxIterations: Schema.number().min(0).max(10000).step(1).default(0).description('Loop 默认轮次上限；0 不限。保存不启动循环。'),
    verify: Schema.string().max(8192).default('').description('默认验收命令；空白使用模型报告。启动时可按项目修改。'),
    verificationTimeout: Schema.number().min(1).max(3600).step(1).default(120).description('独立验收超时（秒），已启动 Loop 不随设置变化。'),
  };
}

/** 0.1.6 及更早的设置页仍注册这份普通 schema。 */
export const SETTINGS_SCHEMA = preferenceSchema();

function live<T>(schema: T): T {
  const candidate = schema as T & { volatile?: () => T };
  return typeof candidate.volatile === 'function' ? candidate.volatile() : schema;
}

/**
 * 0.1.7 起全局配置是当前 Profile 条目的 volatile Config。
 * 旧 schemastery 没有 volatile()，这份 schema 保持普通对象，避免旧宿主加载失败。
 */
export const Config = live(preferenceSchema());

/** 0.1.6 及更早的 settings.register 返回值；0.1.7 已不再导出该类型。 */
interface LegacySettingsScope<T> {
  get(): T;
}

interface SettingsHost {
  register?: (ns: string, schema: typeof SETTINGS_SCHEMA) => LegacySettingsScope<Preferences>;
  configure?: (presentation: { auto?: boolean }, owner?: Fiber) => () => void;
}

function unwrap(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && typeof (value as { get?: unknown }).get === 'function') {
    return (value as { get(): unknown }).get();
  }
  return value;
}

/** 把普通对象或 volatile 引用还原成设置值。缺字段时套用 schema 默认。 */
export function materializePreferences(config: unknown): Preferences | undefined {
  const root = unwrap(config);
  if (!root || typeof root !== 'object') return undefined;
  const plain = Object.fromEntries(Object.entries(root as Record<string, unknown>).map(([key, value]) => [key, unwrap(value)]));
  try { return SETTINGS_SCHEMA(plain) as Preferences; }
  catch { return undefined; }
}

/** 可选设置服务。旧宿主注册 settings.yaml；0.1.7 读取 Profile 里的 volatile 配置。都没有时仅当前会话生效。 */
export class PreferencesBridge {
  private scope: LegacySettingsScope<Preferences> | undefined;
  private mode: 'unknown' | 'legacy' | 'volatile' = 'unknown';
  constructor(private readonly ctx: Context, private readonly config: unknown) {
    setServerLang(resolveUiLang(materializePreferences(config)?.language, hostLocaleOf(ctx)));
    ctx.inject(['settings'], child => {
      const settings = child.settings as SettingsHost;
      if (typeof settings.register === 'function') {
        this.mode = 'legacy';
        this.scope = settings.register(SETTINGS_NAMESPACE, SETTINGS_SCHEMA);
        child.effect(() => () => { this.scope = undefined; this.mode = 'unknown'; });
        return;
      }
      this.mode = 'volatile';
      if (typeof settings.configure === 'function') {
        const dispose = settings.configure({ auto: false }, ctx.fiber);
        child.effect(() => dispose);
      }
    });
  }
  private current(): Preferences | undefined {
    if (this.scope) return materializePreferences(this.scope.get());
    if (this.mode === 'volatile') return materializePreferences(this.config);
    return undefined;
  }
  defaults(): Partial<PuaState> {
    const config = this.current();
    return config ? { ...config, enabled: config.alwaysOn, flavor: config.flavor === 'auto' ? 'alibaba' : config.flavor, flavorLocked: config.flavor !== 'auto' } : {};
  }
  configuration(): Configuration {
    const config = this.current();
    if (!config) return { ...CONFIG_DEFAULTS, enabled: false };
    const { alwaysOn, ...rest } = config;
    return { ...rest, enabled: alwaysOn };
  }
  /** 有设置服务时返回全局开关；没有设置服务时为 undefined，会话命令仍可使用。 */
  globallyEnabled(): boolean | undefined {
    const config = this.current();
    return config ? config.alwaysOn : undefined;
  }
  /** 服务端与模型侧文案的语言；宿主 locale 与设置里的 language 一起决定。 */
  language(): 'zh' | 'en' {
    return resolveUiLang(this.current()?.language, hostLocaleOf(this.ctx));
  }
  description(): string {
    const copy = serverCopy().settings;
    return this.current() ? copy.sessionOnly : copy.sessionOnlyNoHost;
  }
  feedback(): { offline: boolean; frequency: number } {
    const config = this.current();
    return { offline: config?.offline ?? false, frequency: config?.feedbackFrequency ?? 5 };
  }
}
