import test from 'node:test';
import assert from 'node:assert/strict';
import { watchComposerConfiguration, watchActivity } from '../lib/client-refresh.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const ok = value => Promise.resolve({ ok: true, value });

test('新会话未就绪不阻塞全局入口，250ms 后重试并恢复会话状态', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const globals = [], sessions = [];
  const watcher = watchComposerConfiguration({
    getGlobal: () => ok({ values: { enabled: true } }),
    getSession: () => ++calls === 1 ? Promise.resolve({ ok: false, error: { message: '会话尚未加载' } }) : ok({ values: { enabled: false } }),
  }, 'new', value => globals.push(value), value => sessions.push(value));
  await settle();
  assert.equal(globals[0], true);
  assert.equal(sessions.length, 0);
  t.mock.timers.tick(249); await settle(); assert.equal(calls, 1);
  t.mock.timers.tick(1); await settle();
  assert.equal(calls, 2); assert.equal(sessions[0].values.enabled, false);
  watcher.dispose();
  t.mock.timers.tick(4000); await settle(); assert.equal(calls, 2);
});

test('慢会话请求不阻塞全局关闭，刷新不重叠且卸载丢弃迟到响应', async () => {
  let resolveSession, calls = 0;
  const globals = [], sessions = [];
  const watcher = watchComposerConfiguration({
    getGlobal: () => ok({ values: { enabled: false } }),
    getSession: () => { calls++; return new Promise(resolve => { resolveSession = resolve; }); },
  }, 'slow', value => globals.push(value), value => sessions.push(value));
  await settle(); assert.deepEqual(globals, [false]);
  watcher.refresh(); watcher.refresh(); assert.equal(calls, 1);
  watcher.dispose(); resolveSession({ ok: true, value: { values: { enabled: true } } });
  await settle(); assert.equal(sessions.length, 0);
});


test('状态卡片刷新覆盖结束状态，失败清除旧状态，卸载不接收迟到数据', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let pending;
  const received = [];
  let calls = 0;
  const dispose = watchActivity({ getActivity: () => {
    calls++;
    if (calls === 1) return ok({ visible: true });
    if (calls === 2) return ok({ visible: false });
    if (calls === 3) return Promise.reject(Error('连接断开'));
    return new Promise(resolve => { pending = resolve; });
  } }, 'session', value => received.push(value));
  await settle(); assert.equal(received.at(-1).visible, true);
  t.mock.timers.tick(750); await settle(); assert.equal(received.at(-1).visible, false);
  t.mock.timers.tick(750); await settle(); assert.equal(received.at(-1), null);
  t.mock.timers.tick(750); await settle();
  dispose(); pending({ ok: true, value: { visible: true } });
  await settle(); assert.equal(received.length, 3);
  t.mock.timers.tick(5000); await settle(); assert.equal(calls, 4);
});
