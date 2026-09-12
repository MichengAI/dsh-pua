import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '@deepseek-ai/dsh-session';
import { StateStore, RESULT_PREFIX, SESSION_RESULT_PREFIX } from '../lib/state.js';

function command(session, input, prefix = SESSION_RESULT_PREFIX) {
  const commandId = `command-${session.seq}`;
  session.append('command/run', { commandId, name: 'pua', args: input, source: { kind: 'user' } });
  session.append('command/done', { commandId, kind: 'success', text: prefix + '成功' });
}

test('关闭再开启保留角色且不复活排队 Loop；旧历史保留原来的角色重置语义', () => {
  const session = Session.create('role'); const store = new StateStore();
  command(session, 'p9'); command(session, 'off'); command(session, 'on');
  assert.equal(store.read(session).mode, 'p9');
  command(session, 'loop "测试"'); command(session, 'off'); command(session, 'on');
  assert.equal(store.read(session).mode, 'pua');
  assert.equal(store.read(session).loopCommandId, undefined);
  command(session, 'p9'); command(session, '旧任务', RESULT_PREFIX);
  assert.equal(store.read(session).mode, 'pua');
  const revision = store.revision(session); command(session, 'status');
  assert.equal(store.revision(session), revision, '只读命令不触发配置冲突');
});

test('逐项覆盖持久化，显式相同值仍覆盖，重置后重新跟随全局', () => {
  let defaults = { enabled: true, flavor: 'huawei', flavorLocked: true };
  const store = new StateStore(() => defaults);
  const session = Session.create('preferences');
  store.configure(session, { flavor: 'huawei' });
  defaults = { enabled: false, flavor: 'tencent', flavorLocked: true };
  assert.equal(store.read(session).flavor, 'huawei');
  assert.equal(store.read(session).enabled, false);
  const restored = Session.create('restored', session.snapshotEvents());
  const reader = new StateStore(() => defaults);
  assert.equal(reader.read(restored).flavor, 'huawei');
  reader.configure(restored, { flavor: null });
  assert.equal(reader.read(restored).flavor, 'tencent');
  assert.deepEqual(reader.overrides(restored), {});
  assert.deepEqual(restored.deriveMessages(), [], '配置记录不能进入模型上下文');
});

test('配置修改拒绝未知字段、非法值及过期版本，不污染生效状态', () => {
  const store = new StateStore(); const session = Session.create('validation');
  assert.throws(() => store.configure(session, { maxIterations: -1 }));
  assert.throws(() => store.configure(session, { arbitrary: true }));
  const revision = store.revision(session);
  store.configure(session, { enabled: true }, revision);
  assert.throws(() => store.configure(session, { enabled: false }, revision), /其他窗口|过期/);
  assert.equal(store.read(session).enabled, true);
});

test('子代理默认关闭，显式启用继承父生效配置，父关闭可阻止子开启且不继承 Loop', () => {
  const parent = Session.create('parent');
  const child = Session.create('child', [], { version: parent.header.version, id: 'child', createdAt: 1, parentSession: parent.header.id, delegationDepth: 1, isSeeded: false });
  const store = new StateStore(() => ({ enabled: true }), session => session === child ? parent : undefined);
  assert.equal(store.read(child).enabled, false);
  store.configure(parent, { subagents: true, flavor: 'huawei', mode: 'p9' });
  assert.equal(store.read(child).enabled, true);
  assert.equal(store.read(child).flavor, 'huawei');
  assert.equal(store.read(child).mode, 'p9');
  assert.equal(store.read(child).loopCommandId, undefined);
  store.configure(parent, { enabled: false });
  store.configure(child, { enabled: true });
  assert.equal(store.read(child).enabled, false);
});
