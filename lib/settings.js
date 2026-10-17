import Schema from '@deepseek-ai/schemastery';
import { FLAVORS } from './flavors.js';
import { CONFIG_DEFAULTS, CONFIG_MODES, LANGUAGE_PREFS } from './configuration.js';
export const SETTINGS_NAMESPACE = 'michengai-pua';
function preferenceFields() {
    return {
        alwaysOn: Schema.boolean().default(true).description('允许使用 /pua 和聊天入口。关闭后命令和入口隐藏，当前会话也不能开启。不自动注入。'),
        flavor: Schema.union(['auto', ...FLAVORS.map(item => item.id)].map(value => Schema.const(value))).default('auto').description('默认风味；auto 按原版任务路由，指定风味则锁定。'),
        offline: Schema.boolean().default(false).description('离线模式：关闭自愿反馈提醒。本移植始终不包含联网刷新或上报能力。'),
        feedbackFrequency: Schema.number().min(0).max(9999).step(1).default(5).description('每多少次有 PUA 可见输出的交付显示本地反馈入口；0 关闭，不自动记录评分。'),
        mode: Schema.union(CONFIG_MODES.map(value => Schema.const(value))).default('pua').description('默认角色模式。'),
        language: Schema.union(LANGUAGE_PREFS.map(value => Schema.const(value))).default('auto').description('界面语言：auto 跟随宿主，可固定为中文、English 或 Русский。'),
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
/** 把字段声明还原成可校验的普通 schema。0.2.0 起 schemastery 提供 volatile()。 */
export const SETTINGS_SCHEMA = Schema.object(preferenceFields());
export const Config = SETTINGS_SCHEMA.volatile();
function unwrap(value) {
    if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
        return value.get();
    }
    return value;
}
/** 把普通对象或 volatile 引用还原成设置值。缺字段时套用 schema 默认。 */
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
/** 可选设置服务。0.2.0 起读取 Profile 里的 volatile 配置；没有该服务时仅当前会话生效。 */
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
    /** 有设置服务时返回全局开关；没有设置服务时为 undefined，会话命令仍可使用。 */
    globallyEnabled() {
        const config = this.current();
        return config ? config.alwaysOn : undefined;
    }
    description() { return this.current() ? '仅当前会话；全局开关请在「插件」中打开「允许使用 PUA」后修改' : '仅当前会话（宿主未提供 settings）'; }
    feedback() {
        const config = this.current();
        return { offline: config?.offline ?? false, frequency: config?.feedbackFrequency ?? 5 };
    }
}
//# sourceMappingURL=settings.js.map