var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { SessionId } from '@deepseek-ai/dsh-session';
import { DESCRIPTORS } from './remote-contract.js';
import { configSchema, parsePatch } from './configuration.js';
import { SETTINGS_NAMESPACE } from './settings.js';
let PuaRemote = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _getGlobal_decorators;
    let _getActivity_decorators;
    let _setGlobal_decorators;
    let _getSession_decorators;
    let _setSession_decorators;
    let _startLoop_decorators;
    let _cancelLoop_decorators;
    return class PuaRemote extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _getGlobal_decorators = [Remote('getGlobal')];
            _getActivity_decorators = [Remote('getActivity')];
            _setGlobal_decorators = [Remote('setGlobal')];
            _getSession_decorators = [Remote('getSession')];
            _setSession_decorators = [Remote('setSession')];
            _startLoop_decorators = [Remote('startLoop')];
            _cancelLoop_decorators = [Remote('cancelLoop')];
            __esDecorate(this, null, _getGlobal_decorators, { kind: "method", name: "getGlobal", static: false, private: false, access: { has: obj => "getGlobal" in obj, get: obj => obj.getGlobal }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getActivity_decorators, { kind: "method", name: "getActivity", static: false, private: false, access: { has: obj => "getActivity" in obj, get: obj => obj.getActivity }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setGlobal_decorators, { kind: "method", name: "setGlobal", static: false, private: false, access: { has: obj => "setGlobal" in obj, get: obj => obj.setGlobal }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getSession_decorators, { kind: "method", name: "getSession", static: false, private: false, access: { has: obj => "getSession" in obj, get: obj => obj.getSession }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setSession_decorators, { kind: "method", name: "setSession", static: false, private: false, access: { has: obj => "setSession" in obj, get: obj => obj.setSession }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _startLoop_decorators, { kind: "method", name: "startLoop", static: false, private: false, access: { has: obj => "startLoop" in obj, get: obj => obj.startLoop }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _cancelLoop_decorators, { kind: "method", name: "cancelLoop", static: false, private: false, access: { has: obj => "cancelLoop" in obj, get: obj => obj.cancelLoop }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['puaConfiguration', 'agents', 'commands', 'typert'];
        constructor(ctx) {
            super(ctx, 'puaConfig');
            __runInitializers(this, _instanceExtraInitializers);
            ctx.typert.register({ package: '@michengai/dsh-pua', face: 'host', schemas: [], model: { services: [], events: [], objects: [] }, invocations: DESCRIPTORS });
        }
        agent(id) {
            const agent = this.ctx.agents.get(SessionId(id));
            if (!agent)
                throw new Error('会话尚未加载或已关闭，请重新打开会话后重试。');
            return agent;
        }
        getGlobal() {
            const settings = this.ctx.get('settings');
            const descriptor = settings?.describe().find(item => item.ns === SETTINGS_NAMESPACE);
            if (settings && !descriptor)
                throw new Error('PUA 设置服务尚未就绪。');
            const values = this.ctx.puaConfiguration.preferences.configuration();
            return { values, defaults: values, overrides: {}, revision: descriptor?.revision ?? 0, child: false };
        }
        getActivity(id) {
            const agent = this.agent(id);
            const service = this.ctx.puaConfiguration;
            const activity = service.runtime.activity(agent.session);
            const values = service.store.configuration(agent.session);
            const configuration = { mode: values.mode, flavor: values.flavor, language: values.language, subagents: values.subagents };
            // 气泡跟随当前会话是否在跑，不因全局默认关闭而藏掉已经生效的执行。
            return { ...activity, configuration, visible: values.enabled && (agent.status === 'running' || activity.verifying) };
        }
        async setGlobal(input, revision) {
            const settings = this.ctx.get('settings');
            if (!settings)
                throw new Error('宿主未提供全局设置，仅支持会话命令配置。');
            const { enabled: alwaysOn, ...values } = configSchema.parse(input);
            await settings.update(SETTINGS_NAMESPACE, { ...values, alwaysOn }, revision);
            return this.getGlobal();
        }
        getSession(id) {
            const { session } = this.agent(id);
            const service = this.ctx.puaConfiguration;
            const child = (session.header.delegationDepth ?? 0) > 0;
            const parent = child && session.header.parentSession ? this.ctx.agents.get(SessionId(session.header.parentSession)) : undefined;
            return { values: service.store.configuration(session), defaults: parent ? service.store.configuration(parent.session) : service.preferences.configuration(),
                overrides: service.store.overrides(session), revision: service.store.revision(session), child };
        }
        setSession(id, patch, revision) {
            const { session } = this.agent(id);
            const next = parsePatch(patch);
            if (next.enabled === true && this.ctx.puaConfiguration.preferences.globallyEnabled() === false) {
                throw new Error('全局已关闭 PUA，当前会话不能开启。请先在插件设置中开启。');
            }
            this.ctx.puaConfiguration.store.configure(session, next, revision);
            if (!this.ctx.puaConfiguration.store.read(session).enabled)
                this.ctx.puaConfiguration.runtime.cancel(session);
            return this.getSession(id);
        }
        async startLoop(id, task, input) {
            const agent = this.agent(id);
            const values = configSchema.parse(input);
            if (!task.trim() || task.length > 4096)
                throw new Error('请输入 1–4096 字符的任务。');
            // 表单用结构化参数进入同一个原生命令处理器，启动不改写全局或会话默认值。
            const payload = { task, maxIterations: values.maxIterations, verify: values.verify, verificationTimeout: values.verificationTimeout };
            const result = await this.ctx.commands.execute(agent, '/pua loop-json ' + JSON.stringify(payload), [], new AbortController().signal);
            if (!result)
                throw new Error('PUA 命令未注册，请重载后端。');
            if (result.result.kind !== 'success')
                throw new Error(result.result.text);
            return { text: result.result.text ?? 'Loop 已提交。' };
        }
        async cancelLoop(id) {
            const result = await this.ctx.commands.execute(this.agent(id), '/pua-cancel-loop', [], new AbortController().signal);
            if (!result)
                throw new Error('PUA 命令未注册，请重载后端。');
            if (result.result.kind !== 'success')
                throw new Error(result.result.text);
            return { text: result.result.text ?? 'Loop 已取消。' };
        }
    };
})();
/** 复用 DSH 已鉴权的 Typert Gateway；全局写入只由插件设置页调用。 */
export default PuaRemote;
//# sourceMappingURL=remote.js.map