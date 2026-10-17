import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {} from '@deepseek-ai/dsh-typert-registry';
import { SessionId } from '@deepseek-ai/dsh-session';
import { DESCRIPTORS, type ActivitySnapshot, type ConfigurationSnapshot } from './remote-contract.js';
import { configSchema, parsePatch, type Configuration, type ConfigurationPatch } from './configuration.js';
import { SETTINGS_NAMESPACE } from './settings.js';
import type {} from './index.js';

/** Reuses DSH's authenticated Typert Gateway; global writes are only issued by the plugin settings page. */
export default class PuaRemote extends TypertRemoteService {
  static inject = ['puaConfiguration', 'agents', 'commands', 'typert'];
  constructor(ctx: Context) {
    super(ctx, 'puaConfig');
    ctx.typert.register({ package: '@phucnd0604/dsh-pua-en', face: 'host', schemas: [], model: { services: [], events: [], objects: [] }, invocations: DESCRIPTORS });
  }
  private agent(id: string) {
    const agent = this.ctx.agents.get(SessionId(id));
    if (!agent) throw new Error('The session is not loaded or has been closed; reopen the session and try again.');
    return agent;
  }
  @Remote('getGlobal')
  getGlobal(): ConfigurationSnapshot {
    const settings = this.ctx.get('settings') as { describe(): { ns: string; revision: number }[] } | undefined;
    const descriptor = settings?.describe().find(item => item.ns === SETTINGS_NAMESPACE);
    if (settings && !descriptor) throw new Error('The PUA settings service is not ready yet.');
    const values = this.ctx.puaConfiguration.preferences.configuration();
    return { values, defaults: values, overrides: {}, revision: descriptor?.revision ?? 0, child: false };
  }
  @Remote('getActivity')
  getActivity(id: string): ActivitySnapshot {
    const agent = this.agent(id);
    const service = this.ctx.puaConfiguration;
    const activity = service.runtime.activity(agent.session);
    const values = service.store.configuration(agent.session);
    const configuration = { mode: values.mode, flavor: values.flavor, language: values.language, subagents: values.subagents };
    // The bubble follows whether the current session is running; it does not hide an execution that is already in effect just because the global default is off.
    return { ...activity, configuration, visible: values.enabled && (agent.status === 'running' || activity.verifying) };
  }
  @Remote('setGlobal')
  async setGlobal(input: Configuration, revision: number): Promise<ConfigurationSnapshot> {
    const settings = this.ctx.get('settings');
    if (!settings) throw new Error('The host provides no global settings; only per-session command configuration is supported.');
    const { enabled: alwaysOn, ...values } = configSchema.parse(input);
    await settings.update(SETTINGS_NAMESPACE, { ...values, alwaysOn }, revision);
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
    const next = parsePatch(patch);
    if (next.enabled === true && this.ctx.puaConfiguration.preferences.globallyEnabled() === false) {
      throw new Error('"Allow PUA" is off, so the current session cannot enable it. Turn it on in the plugin settings first.');
    }
    this.ctx.puaConfiguration.store.configure(session, next, revision);
    if (!this.ctx.puaConfiguration.store.read(session).enabled) this.ctx.puaConfiguration.runtime.cancel(session);
    return this.getSession(id);
  }
  @Remote('startLoop')
  async startLoop(id: string, task: string, input: Configuration): Promise<{ text: string }> {
    const agent = this.agent(id);
    const values = configSchema.parse(input);
    if (!task.trim() || task.length > 4096) throw new Error('Enter a task of 1–4096 characters.');
    // The form enters the same native command handler with structured arguments; starting a loop rewrites neither the global nor the session defaults.
    const payload = { task, maxIterations: values.maxIterations, verify: values.verify, verificationTimeout: values.verificationTimeout };
    const result = await this.ctx.commands.execute(agent, '/pua loop-json ' + JSON.stringify(payload), [], new AbortController().signal);
    if (!result) throw new Error('The PUA command is not registered; reload the backend.');
    if (result.result.kind !== 'success') throw new Error(result.result.text);
    return { text: result.result.text ?? 'Loop submitted.' };
  }
  @Remote('cancelLoop')
  async cancelLoop(id: string): Promise<{ text: string }> {
    const result = await this.ctx.commands.execute(this.agent(id), '/pua-cancel-loop', [], new AbortController().signal);
    if (!result) throw new Error('The PUA command is not registered; reload the backend.');
    if (result.result.kind !== 'success') throw new Error(result.result.text);
    return { text: result.result.text ?? 'Loop cancelled.' };
  }
}
