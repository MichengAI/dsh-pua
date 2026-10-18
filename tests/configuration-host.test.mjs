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

test('Real Host configuration service isolates global from session, rejects stale saves, and keeps the pre-write state on write failure', async t => {
  const { ctx, remote, agent, fail } = await setup(t);
  const initial = remote.getGlobal();
  assert.equal(initial.values.subagents, false);
  remote.setSession(agent.id, { flavor: 'huawei', enabled: false }, 0);
  assert.deepEqual(remote.getGlobal(), initial);
  await remote.setGlobal({ ...initial.values, flavor: 'tencent', mode: 'p9' }, initial.revision);
  assert.equal(remote.getSession(agent.id).values.flavor, 'huawei');
  assert.equal(remote.getSession(agent.id).values.mode, 'p9');
  await assert.rejects(remote.setGlobal(initial.values, initial.revision), /revision|changed|conflict/i);
  const current = remote.getGlobal(); fail(true);
  await assert.rejects(remote.setGlobal({ ...current.values, mode: 'pro' }, current.revision), /磁盘/);
  assert.deepEqual(remote.getGlobal(), current);
  assert.throws(() => remote.setSession(agent.id, { subagents: true }, 0), /another window/i);
  assert.throws(() => remote.setSession('unknown-session', { enabled: true }, 0), /session/i);
  assert.deepEqual(agent.session.deriveMessages(), []);
  assert.ok(ctx.typert.local, 'Remote descriptors are registered in the real Typert Registry');
  for (const descriptor of DESCRIPTORS) {
    assert.equal(typeof descriptor.result.create, 'function');
    assert.equal(typeof descriptor.result.create().parse, 'function');
    for (const parameter of descriptor.parameters) {
      assert.equal(typeof parameter.codec.create, 'function');
      assert.equal(typeof parameter.codec.create().parse, 'function');
    }
  }
});

test('A real parent and child Agent agree on the prompt switch; with the subagent policy off, PUA is not injected', async t => {
  const { ctx, remote, agent } = await setup(t);
  const childHandle = await agent.ctx.agents.create({ sessionId: 'expert-child', parentAgent: agent,
    meta: { parentSession: agent.id, delegationDepth: 1, origin: 'subagent' }, agentOptions: {} });
  t.after(() => childHandle.dispose());
  const prompt = async () => renderPrompt(await ctx.systemPrompt.assemble({ agent: childHandle.agent }));
  assert.doesNotMatch(await prompt(), /PUA/);
  remote.setSession(agent.id, { enabled: true, subagents: true, flavor: 'huawei', mode: 'p9' }, 0);
  assert.match(await prompt(), /User-locked flavor: huawei/);
  assert.match(await prompt(), /Current DSH mode: p9/);
  ctx.puaConfiguration.runtime.read(agent.session).failureCount = 4;
  assert.equal(ctx.puaConfiguration.runtime.read(childHandle.agent.session).failureCount, 0);
  remote.setSession(agent.id, { enabled: false }, remote.getSession(agent.id).revision);
  assert.doesNotMatch(await prompt(), /PUA/);
});

test('The Remote Loop form uses the native command; start parameters rewrite neither global nor session defaults', async t => {
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


test('Without settings the Remote stays active: session commands work while global writes are explicitly rejected', async t => {
  const { ctx, remote, agent } = await setup(t, false);
  assert.ok(remote);
  assert.equal(remote.getGlobal().values.enabled, false);
  await assert.rejects(remote.setGlobal(remote.getGlobal().values, 0), /no global settings/i);
  await ctx.commands.execute(agent, '/pua on', [], new AbortController().signal);
  assert.equal(remote.getSession(agent.id).values.enabled, true);
});

test('Same-value commands create no configuration conflict; the first enable and restoring inheritance still change the revision', async t => {
  const { ctx, remote, agent } = await setup(t);
  const run = text => ctx.commands.execute(agent, text, [], new AbortController().signal);
  await run('/pua again');
  const revision = remote.getSession(agent.id).revision;
  for (const text of ['/pua done-check', '/pua 证据呢', '/pua survey']) await run(text);
  assert.equal(remote.getSession(agent.id).revision, revision);
  remote.setSession(agent.id, { flavor: 'huawei' }, revision);
  assert.ok(remote.getSession(agent.id).revision > revision);
});


test('Global saves go through the optional service and never touch an uninjected settings property', async t => {
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
