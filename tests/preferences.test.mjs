import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '@deepseek-ai/dsh-session';
import { StateStore, RESULT_PREFIX, SESSION_RESULT_PREFIX } from '../lib/state.js';

function command(session, input, prefix = SESSION_RESULT_PREFIX) {
  const commandId = `command-${session.seq}`;
  session.append('command/run', { commandId, name: 'pua', args: input, source: { kind: 'user' } });
  session.append('command/done', { commandId, kind: 'success', text: prefix + '成功' });
}

test('Turning off then on keeps the role and does not revive a queued Loop; old history keeps the original role-reset semantics', () => {
  const session = Session.create('role'); const store = new StateStore();
  command(session, 'p9'); command(session, 'off'); command(session, 'on');
  assert.equal(store.read(session).mode, 'p9');
  command(session, 'loop "测试"'); command(session, 'off'); command(session, 'on');
  assert.equal(store.read(session).mode, 'pua');
  assert.equal(store.read(session).loopCommandId, undefined);
  command(session, 'p9'); command(session, '旧任务', RESULT_PREFIX);
  assert.equal(store.read(session).mode, 'pua');
  const revision = store.revision(session); command(session, 'status');
  assert.equal(store.revision(session), revision, 'A read-only command does not trigger a configuration conflict');
});

test('Per-key overrides persist, an explicit same value still overrides, and after reset it follows the global again', () => {
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
  assert.deepEqual(restored.deriveMessages(), [], 'Configuration records must not enter the model context');
});

test('Configuration changes reject unknown fields, invalid values, and stale revisions, without polluting the effective state', () => {
  const store = new StateStore(); const session = Session.create('validation');
  assert.throws(() => store.configure(session, { maxIterations: -1 }));
  assert.throws(() => store.configure(session, { arbitrary: true }));
  const revision = store.revision(session);
  store.configure(session, { enabled: true }, revision);
  assert.throws(() => store.configure(session, { enabled: false }, revision), /another window/i);
  assert.equal(store.read(session).enabled, true);
});

test('Subagents are off by default; explicit enablement inherits the parent effective configuration while a parent off blocks a child enable and inherits no Loop', () => {
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
