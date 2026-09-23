import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { AgentRegistry } from '@deepseek-ai/dsh-agent';
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { LlmRuntime } from '@deepseek-ai/dsh-llm';
import { CommandRuntime } from '@deepseek-ai/dsh-commands';
import { SystemPrompt, renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry';
import { installSettings } from './settings-host.mjs';
import { resolveAgentLoopConfig } from './agent-loop-config.mjs';
import PuaRemote from '../lib/remote.js';
import * as plugin from '../lib/index.js';
import { DESCRIPTORS } from '../lib/remote-contract.js';

async function setup(t, settings = true) {
  const ctx = new Context(); t.after(() => ctx.fiber.dispose());
  new SessionStore(ctx); new AgentRegistry(ctx); new SessionProjectionRegistry(ctx); new LlmRuntime(ctx);
  new CommandRuntime(ctx); new SystemPrompt(ctx, { includeHarnessIdentity: false }); new ToolRuntime(ctx);
  new AgentLoop(ctx, resolveAgentLoopConfig(AgentLoop)); new TypertRegistry(ctx);
  const settingsHost = settings ? await installSettings(ctx) : undefined;
  const installed = ctx.plugin(plugin); await installed.await();
  settingsHost?.attach(installed.config);
  const remotePlugin = ctx.plugin(PuaRemote); await remotePlugin.await();
  const handle = await ctx.agents.create({ sessionId: 'config-host', agentOptions: {} });
  t.after(() => handle.dispose());
  return { ctx, agent: handle.agent, remote: ctx.puaConfig, fail: value => settingsHost?.fail(value) };
}

test('真实 Host 配置服务隔离全局与会话，拒绝过期保存并保留写入失败前状态', async t => {
  const { ctx, remote, agent, fail } = await setup(t);
  const initial = remote.getGlobal();
  assert.equal(initial.values.subagents, false);
  remote.setSession(agent.id, { flavor: 'huawei', enabled: false }, 0);
  assert.deepEqual(remote.getGlobal(), initial);
  await remote.setGlobal({ ...initial.values, flavor: 'tencent', mode: 'p9' }, initial.revision);
  assert.equal(remote.getSession(agent.id).values.flavor, 'huawei');
  assert.equal(remote.getSession(agent.id).values.mode, 'p9');
  await assert.rejects(remote.setGlobal(initial.values, initial.revision), /revision|changed|修改|conflict/i);
  const current = remote.getGlobal(); fail(true);
  await assert.rejects(remote.setGlobal({ ...current.values, mode: 'pro' }, current.revision), /磁盘/);
  assert.deepEqual(remote.getGlobal(), current);
  assert.throws(() => remote.setSession(agent.id, { subagents: true }, 0), /其他窗口/);
  assert.throws(() => remote.setSession('unknown-session', { enabled: true }, 0), /会话/);
  assert.deepEqual(agent.session.deriveMessages(), []);
  assert.ok(ctx.typert.local, 'Remote 描述符已在实际 Typert Registry 注册');
  for (const descriptor of DESCRIPTORS) {
    assert.equal(typeof descriptor.result.create, 'function');
    assert.equal(typeof descriptor.result.schema.parse, 'function');
    for (const parameter of descriptor.parameters) {
      assert.equal(typeof parameter.codec.create, 'function');
      assert.equal(typeof parameter.codec.schema.parse, 'function');
    }
  }
});

test('实际父子 Agent 的提示词开关一致，关闭子代理策略时不注入 PUA', async t => {
  const { ctx, remote, agent } = await setup(t);
  const childHandle = await agent.ctx.agents.create({ sessionId: 'expert-child', parentAgent: agent,
    meta: { parentSession: agent.id, delegationDepth: 1, origin: 'subagent' }, agentOptions: {} });
  t.after(() => childHandle.dispose());
  const prompt = async () => renderPrompt(await ctx.systemPrompt.assemble({ agent: childHandle.agent }));
  assert.doesNotMatch(await prompt(), /PUA/);
  remote.setSession(agent.id, { subagents: true, flavor: 'huawei', mode: 'p9' }, 0);
  assert.match(await prompt(), /用户锁定风味：huawei/);
  assert.match(await prompt(), /当前 DSH 模式：p9/);
  ctx.puaConfiguration.runtime.read(agent.session).failureCount = 4;
  assert.equal(ctx.puaConfiguration.runtime.read(childHandle.agent.session).failureCount, 0);
  remote.setSession(agent.id, { enabled: false }, remote.getSession(agent.id).revision);
  assert.doesNotMatch(await prompt(), /PUA/);
});

test('Remote Loop 表单走原生命令，启动参数不改写全局或会话默认', async t => {
  const { remote, agent } = await setup(t);
  const messages = [];
  agent.followup = message => messages.push(message);
  const before = remote.getGlobal();
  await remote.startLoop(agent.id, '检查本次参数', { ...before.values, maxIterations: 2, verificationTimeout: 9 });
  assert.equal(messages.length, 1);
  assert.match(messages[0].content[0].text, /"maxIterations":2/);
  assert.match(messages[0].content[0].text, /"verificationTimeout":9/);
  assert.deepEqual(remote.getGlobal(), before);
  assert.equal(remote.getSession(agent.id).values.maxIterations, before.values.maxIterations);
  assert.equal(remote.getSession(agent.id).values.verificationTimeout, before.values.verificationTimeout);
  await remote.cancelLoop(agent.id);
});


test('无 settings 时 Remote 仍激活，会话命令可用而全局写入明确拒绝', async t => {
  const { ctx, remote, agent } = await setup(t, false);
  assert.ok(remote);
  assert.equal(remote.getGlobal().values.enabled, false);
  await assert.rejects(remote.setGlobal(remote.getGlobal().values, 0), /未提供全局设置/);
  await ctx.commands.execute(agent, '/pua on', [], new AbortController().signal);
  assert.equal(remote.getSession(agent.id).values.enabled, true);
});

test('同值命令不制造配置冲突，首次开启与恢复继承仍改变 revision', async t => {
  const { ctx, remote, agent } = await setup(t);
  const run = text => ctx.commands.execute(agent, text, [], new AbortController().signal);
  await run('/pua again');
  const revision = remote.getSession(agent.id).revision;
  for (const text of ['/pua done-check', '/pua 证据呢', '/pua survey']) await run(text);
  assert.equal(remote.getSession(agent.id).revision, revision);
  remote.setSession(agent.id, { flavor: 'huawei' }, revision);
  assert.ok(remote.getSession(agent.id).revision > revision);
});


test('全局保存通过可选服务访问，不触发未注入 settings 的属性访问', async t => {
  const { ctx, remote } = await setup(t);
  const guarded = {
    ctx: new Proxy(ctx, { get(target, key) {
      if (key === 'settings') throw new Error('cannot get property "settings" without inject');
      return Reflect.get(target, key);
    } }),
    getGlobal: () => remote.getGlobal(),
  };
  const initial = remote.getGlobal();
  await PuaRemote.prototype.setGlobal.call(guarded, { ...initial.values, flavor: 'tencent' }, initial.revision);
  assert.equal(remote.getGlobal().values.flavor, 'tencent');
});
