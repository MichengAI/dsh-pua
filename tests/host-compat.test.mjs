import test from 'node:test';
import assert from 'node:assert/strict';
import { Context, Service } from '@deepseek-ai/cordis';
import { isPluginSource, pluginSource, COMMAND_PLUGIN, RUNTIME_PLUGIN } from '../lib/message-source.js';
import { PreferencesBridge } from '../lib/settings.js';
import { PuaRuntime } from '../lib/runtime.js';
import { StateStore } from '../lib/state.js';
import { SourceCatalog } from '../lib/source.js';

const PREFERENCES = {
  alwaysOn: false, flavor: 'huawei', mode: 'p9', subagents: true, terminalReview: true,
  failureCandidates: true, qualityTriggers: true, offline: true, feedbackFrequency: 2,
  maxIterations: 3, verify: 'npm test', verificationTimeout: 9,
};

test('消息来源同时认识旧包装和 V4 生产者 kind', () => {
  const written = pluginSource(COMMAND_PLUGIN);
  assert.equal(isPluginSource(written, COMMAND_PLUGIN), true);
  assert.equal(isPluginSource({ kind: 'plugin', plugin: RUNTIME_PLUGIN }, RUNTIME_PLUGIN), true);
  assert.equal(isPluginSource({ kind: `plugin:${RUNTIME_PLUGIN}` }, RUNTIME_PLUGIN), true);
  assert.equal(isPluginSource({ kind: 'plugin', plugin: COMMAND_PLUGIN }, RUNTIME_PLUGIN), false);
  assert.equal(isPluginSource({ kind: 'user' }, COMMAND_PLUGIN), false);
});

test('两种历史运行记录都能恢复失败计数', () => {
  const ctx = new Context();
  const runtime = new PuaRuntime(ctx, new StateStore(), new SourceCatalog(), new AbortController().signal);
  const record = source => ({
    ownEvents: () => [{
      type: 'user/message',
      data: { source, content: [{ type: 'text', text: 'PUA_RUNTIME_V1 {"failureCount":3,"failures":["kept"]}\n说明' }] },
    }],
  });
  assert.equal(runtime.read(record({ kind: 'plugin', plugin: RUNTIME_PLUGIN })).failureCount, 3);
  assert.equal(runtime.read(record({ kind: `plugin:${RUNTIME_PLUGIN}` })).failureCount, 3);
  assert.equal(runtime.read(record({ kind: 'user' })).failureCount, 0);
});

test('没有 register 的设置服务读取 volatile 配置', async () => {
  const ctx = new Context();
  class FakeSettings extends Service {
    constructor(context) { super(context, 'settings'); }
    configure() { return () => {}; }
  }
  new FakeSettings(ctx);
  const bridge = new PreferencesBridge(ctx, { get: () => PREFERENCES });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bridge.configuration().enabled, false);
  assert.equal(bridge.configuration().flavor, 'huawei');
  assert.equal(bridge.configuration().mode, 'p9');
  assert.equal(bridge.configuration().verify, 'npm test');
  assert.deepEqual(bridge.feedback(), { offline: true, frequency: 2 });
  assert.match(bridge.description(), /插件/);
  assert.equal(bridge.defaults().flavorLocked, true);
});
