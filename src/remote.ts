import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {} from '@deepseek-ai/dsh-typert-registry';
import { SessionId } from '@deepseek-ai/dsh-session';
import { DESCRIPTORS, type ActivitySnapshot, type ConfigurationSnapshot } from './remote-contract.js';
import { configSchema, parsePatch, type Configuration, type ConfigurationPatch } from './configuration.js';
import type {} from './index.js';

/** 复用 DSH 已鉴权的 Typert Gateway；全局写入只由插件设置页调用。 */
export default class PuaRemote extends TypertRemoteService {
  static inject = ['puaConfiguration', 'agents', 'commands', 'typert'];
  constructor(ctx: Context) {
    super(ctx, 'puaConfig');
    ctx.typert.register({ package: '@michengai/dsh-pua', face: 'host', schemas: [], model: { services: [], events: [], objects: [] }, invocations: DESCRIPTORS });
  }
  private agent(id: string) {
    const agent = this.ctx.agents.get(SessionId(id));
    if (!agent) throw new Error('会话尚未加载或已关闭，请重新打开会话后重试。');
    return agent;
  }
  @Remote('getGlobal')
  getGlobal(): ConfigurationSnapshot {
    const descriptor = this.ctx.get('settings')?.describe().find(item => item.ns === 'michengai-pua');
    if (this.ctx.get('settings') && !descriptor) throw new Error('PUA 设置服务尚未就绪。');
    const values = this.ctx.puaConfiguration.preferences.configuration();
    return { values, defaults: values, overrides: {}, revision: descriptor?.revision ?? 0, child: false };
  }
  @Remote('getActivity')
  getActivity(id: string): ActivitySnapshot {
    const agent = this.agent(id);
    const service = this.ctx.puaConfiguration;
    const activity = service.runtime.activity(agent.session);
    const values = service.store.configuration(agent.session);
    const configuration = { mode: values.mode, flavor: values.flavor, subagents: values.subagents };
    const enabled = service.preferences.configuration().enabled && values.enabled;
    // 历史 active Loop 不能证明宿主当前仍在执行任务。
    return { ...activity, configuration, visible: enabled && (agent.status === 'running' || activity.verifying) };
  }
  @Remote('setGlobal')
  async setGlobal(input: Configuration, revision: number): Promise<ConfigurationSnapshot> {
    const settings = this.ctx.get('settings');
    if (!settings) throw new Error('宿主未提供全局设置，仅支持会话命令配置。');
    const { enabled: alwaysOn, ...values } = configSchema.parse(input);
    await settings.update('michengai-pua', { ...values, alwaysOn }, revision);
    return this.getGlobal();
  }
  @Remote('getSession')
  getSession(id: string): ConfigurationSnapshot {
    const { session } = this.agent(id);
    const service = this.ctx.puaConfiguration;
    const child = (session.header.delegationDepth ?? 0) > 0;
    const parent = child && session.header.parentSession ? this.ctx.agents.get(SessionId(session.header.parentSession)) : undefined;
    return { values: service.store.configuration(session), defaults: parent ? service.store.configuration(parent.session) : service.preferences.configuration(),
      overrides: service.store.overrides(session), revision: service.store.revision(session), child };
  }
  @Remote('setSession')
  setSession(id: string, patch: ConfigurationPatch, revision: number): ConfigurationSnapshot {
    const { session } = this.agent(id);
    this.ctx.puaConfiguration.store.configure(session, parsePatch(patch), revision);
    if (!this.ctx.puaConfiguration.store.read(session).enabled) this.ctx.puaConfiguration.runtime.cancel(session);
    return this.getSession(id);
  }
  @Remote('startLoop')
  async startLoop(id: string, task: string, input: Configuration): Promise<{ text: string }> {
    const agent = this.agent(id);
    const values = configSchema.parse(input);
    if (!task.trim() || task.length > 4096) throw new Error('请输入 1–4096 字符的任务。');
    // 表单用结构化参数进入同一个原生命令处理器，启动不改写全局或会话默认值。
    const payload = { task, maxIterations: values.maxIterations, verify: values.verify, verificationTimeout: values.verificationTimeout };
    const result = await this.ctx.commands.execute(agent, '/pua loop-json ' + JSON.stringify(payload), [], new AbortController().signal);
    if (!result) throw new Error('PUA 命令未注册，请重载后端。');
    if (result.result.kind !== 'success') throw new Error(result.result.text);
    return { text: result.result.text ?? 'Loop 已提交。' };
  }
  @Remote('cancelLoop')
  async cancelLoop(id: string): Promise<{ text: string }> {
    const result = await this.ctx.commands.execute(this.agent(id), '/pua-cancel-loop', [], new AbortController().signal);
    if (!result) throw new Error('PUA 命令未注册，请重载后端。');
    if (result.result.kind !== 'success') throw new Error(result.result.text);
    return { text: result.result.text ?? 'Loop 已取消。' };
  }
}
