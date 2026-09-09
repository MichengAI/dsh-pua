// 验证命令增量恢复不会改变并发顺序、默认设置或 pending 的语义。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '@deepseek-ai/dsh-session';
import { StateStore } from '../lib/state.js';

const start = (session, commandId, args) => session.append('command/run', { commandId, name: 'pua', args, source: { kind: 'user' } });
const finish = (session, commandId, kind = 'success') => session.append('command/done', { commandId, kind, text: 'PUA · 测试结果' });

test('命令缓存只消费新增日志，普通事件不重新折叠配置', () => {
  const session = Session.create('incremental');
  const store = new StateStore();
  for (let i = 0; i < 200; i++) { start(session, String(i), 'on'); finish(session, String(i)); }
  const initial = store.read(session);
  const snapshot = session.snapshotEvents.bind(session);
  const consumed = [];
  session.snapshotEvents = (...args) => { const events = snapshot(...args); consumed.push(events.length); return events; };
  session.ownEvents = () => { assert.fail('已预热的读取不应再次扫描全部 ownEvents'); };
  assert.strictEqual(store.read(session), initial);
  session.append('turn/start', { turn: 1 });
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
  assert.strictEqual(store.read(session), initial);
  assert.ok(consumed.reduce((a, b) => a + b, 0) <= 2);
  start(session, 'off', 'off'); finish(session, 'off');
  assert.equal(store.read(session).enabled, false);
});

test('缓存保留命令进入顺序、pending 回滚和动态默认值', () => {
  const session = Session.create('pending');
  let defaults = { enabled: true, flavor: 'huawei' };
  const store = new StateStore(() => defaults);
  assert.equal(store.read(session).flavor, 'huawei');
  defaults = { enabled: false, flavor: 'tencent' };
  assert.equal(store.read(session).enabled, false);
  assert.equal(store.read(session).flavor, 'tencent');
  start(session, 'slow', 'on');
  assert.equal(store.read(session).enabled, false);
  store.stage(session, 'slow', { kind: 'on' });
  assert.equal(store.read(session).enabled, true);
  store.rollback(session, 'slow');
  assert.equal(store.read(session).enabled, false);
  store.stage(session, 'slow', { kind: 'on' });
  start(session, 'newer', 'off'); finish(session, 'newer');
  assert.equal(store.read(session).enabled, false);
  finish(session, 'slow');
  assert.equal(store.read(session).enabled, false);
  defaults = { enabled: true, flavor: 'alibaba' };
  assert.equal(store.read(session).enabled, false);
  start(session, 'failed', 'on'); store.stage(session, 'failed', { kind: 'on' });
  assert.equal(store.read(session).enabled, true);
  finish(session, 'failed', 'error');
  assert.equal(store.read(session).enabled, false);
  assert.equal(new StateStore().read(Session.create('restored', session.snapshotEvents())).enabled, false);
});
