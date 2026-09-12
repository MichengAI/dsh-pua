import type { Context } from '@deepseek-ai/cordis';
import type { SettingsScope } from '@deepseek-ai/dsh-settings';
import Schema from '@deepseek-ai/schemastery';
import { FLAVORS, type FlavorId } from './flavors.js';
import type { PuaState } from './state.js';
import { CONFIG_DEFAULTS, CONFIG_MODES, type Configuration } from './configuration.js';

export interface Preferences extends Omit<Configuration, 'enabled'> { alwaysOn: boolean }
export const SETTINGS_SCHEMA = Schema.object({
  alwaysOn: Schema.boolean().default(true).description('默认开启 PUA（与原版一致）；会话内显式 on/off 优先。'),
  flavor: Schema.union((['auto', ...FLAVORS.map(item => item.id)] as const).map(value => Schema.const(value))).default('auto').description('默认风味；auto 按原版任务路由，指定风味则锁定。'),
  offline: Schema.boolean().default(false).description('离线模式：关闭自愿反馈提醒。本移植始终不包含联网刷新或上报能力。'),
  feedbackFrequency: Schema.number().min(0).max(9999).step(1).default(5).description('每多少次有 PUA 可见输出的交付显示本地反馈入口；0 关闭，不自动记录评分。'),
  mode: Schema.union(CONFIG_MODES.map(value => Schema.const(value))).default('pua').description('默认角色模式。'),
  subagents: Schema.boolean().default(false).description('对子代理启用 PUA；使用父会话生效配置，不继承 Loop 和失败计数。'),
  terminalReview: Schema.boolean().default(true).description('终端异常文本核验提醒。'),
  failureCandidates: Schema.boolean().default(true).description('失败后的升级候选提示，仍须核验任务失败。'),
  qualityTriggers: Schema.boolean().default(true).description('用户不满或要求证据时的质量纠偏提示。'),
  maxIterations: Schema.number().min(0).max(10000).step(1).default(0).description('Loop 默认轮次上限；0 不限。保存不启动循环。'),
  verify: Schema.string().max(8192).default('').description('默认验收命令；空白使用模型报告。启动时可按项目修改。'),
  verificationTimeout: Schema.number().min(1).max(3600).step(1).default(120).description('独立验收超时（秒），已启动 Loop 不随设置变化。'),
});

/** 可选设置服务：标准 DSH 设置页自动读取此 schema；无服务时仅当前会话生效。 */
export class PreferencesBridge {
  private scope: SettingsScope<Preferences> | undefined;
  constructor(ctx: Context) {
    ctx.inject(['settings'], child => {
      this.scope = child.settings.register('michengai-pua', SETTINGS_SCHEMA);
      child.effect(() => () => { this.scope = undefined; });
    });
  }
  defaults(): Partial<PuaState> {
    const config = this.scope?.get();
    return config ? { ...config, enabled: config.alwaysOn, flavor: config.flavor === 'auto' ? 'alibaba' : config.flavor, flavorLocked: config.flavor !== 'auto' } : {};
  }
  configuration(): Configuration {
    const config = this.scope?.get();
    if (!config) return { ...CONFIG_DEFAULTS, enabled: false };
    const { alwaysOn, ...rest } = config;
    return { ...rest, enabled: alwaysOn };
  }
  description(): string { return this.scope ? '仅当前会话；全局默认请在设置 → 插件 → PUA 配置中修改' : '仅当前会话（宿主未提供 settings）'; }
  feedback(): { offline: boolean; frequency: number } {
    const config = this.scope?.get();
    return { offline: config?.offline ?? false, frequency: config?.feedbackFrequency ?? 5 };
  }
}
