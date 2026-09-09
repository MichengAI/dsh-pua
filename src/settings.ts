import type { Context } from '@deepseek-ai/cordis';
import type { SettingsScope } from '@deepseek-ai/dsh-settings';
import Schema from '@deepseek-ai/schemastery';
import { FLAVORS, type FlavorId } from './flavors.js';
import type { Action } from './args.js';
import type { PuaState } from './state.js';

export interface Preferences { alwaysOn: boolean; flavor: FlavorId | 'auto'; offline: boolean; feedbackFrequency: number }
export const SETTINGS_SCHEMA = Schema.object({
  alwaysOn: Schema.boolean().default(true).description('默认开启 PUA（与原版一致）；会话内显式 on/off 优先。'),
  flavor: Schema.union((['auto', ...FLAVORS.map(item => item.id)] as const).map(value => Schema.const(value))).default('auto').description('默认风味；auto 按原版任务路由，指定风味则锁定。'),
  offline: Schema.boolean().default(false).description('离线模式：关闭自愿反馈提醒。本移植始终不包含联网刷新或上报能力。'),
  feedbackFrequency: Schema.number().min(0).max(9999).step(1).default(5).description('每多少次有 PUA 可见输出的交付显示本地反馈入口；0 关闭，不自动记录评分。'),
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
    return config ? { enabled: config.alwaysOn, flavor: config.flavor === 'auto' ? 'alibaba' : config.flavor, flavorLocked: config.flavor !== 'auto' } : {};
  }
  description(): string { return this.scope ? '当前会话及 DSH profile 默认设置' : '仅当前会话（宿主未提供 settings）'; }
  feedback(): { offline: boolean; frequency: number } {
    const config = this.scope?.get();
    return { offline: config?.offline ?? false, frequency: config?.feedbackFrequency ?? 5 };
  }
  async update(action: Action): Promise<void> {
    if (!this.scope) return;
    if (action.kind === 'on' || action.kind === 'off') await this.scope.update({ alwaysOn: action.kind === 'on' });
    if (action.kind === 'flavor') await this.scope.update({ flavor: action.flavor });
    if (action.kind === 'offline') await this.scope.update({ offline: true });
  }
}
