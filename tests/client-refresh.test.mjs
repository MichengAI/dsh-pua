import { installToolExecutor } from "./tool-executor.mjs";
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

test('watchComposerConfiguration 成功后休眠，不无脑轮询，仅在手动 refresh 时发起请求', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const watcher = watchComposerConfiguration({
    getGlobal: () => ok({ values: { enabled: true } }),
    getSession: () => { calls++; return ok({ values: { enabled: true } }); },
  }, 'idle-session', () => {}, () => {});
  await settle();
  assert.equal(calls, 1);
  // 过去 10 秒，确认没有定时器盲轮询发请求
  t.mock.timers.tick(10000); await settle();
  assert.equal(calls, 1);
  // 手动调用 refresh（例如窗口获得焦点或打开弹窗）
  watcher.refresh();
  await settle();
  assert.equal(calls, 2);
  watcher.dispose();
});

test('watchActivity 传入 isRunning 时在闲置态自动休眠，处于运行态或 visible 时轮询并在结束后再次休眠', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  let running = false;
  let visible = false;
  const received = [];
  const handle = watchActivity({
    getActivity: () => {
      calls++;
      return ok({ visible });
    },
  }, 'session-idle', value => received.push(value), { isRunning: () => running });

  // 1. 首次挂载拉取 1 次，当前既没有运行也没有 visible，应自动休眠
  await settle();
  assert.equal(calls, 1);
  assert.equal(received.at(-1).visible, false);
  t.mock.timers.tick(5000); await settle();
  assert.equal(calls, 1, '闲置期间保持休眠，不再发送无意义的轮询请求');

  // 2. 外部事件（会话开始运行，用户发送消息）唤醒
  running = true;
  visible = true;
  handle.refresh();
  await settle();
  assert.equal(calls, 2);
  // 处于运行态时，按 750ms 频率轮询
  t.mock.timers.tick(750); await settle();
  assert.equal(calls, 3);

  // 3. 任务结束（Agent 变 idle，visible 变 false）
  running = false;
  visible = false;
  t.mock.timers.tick(750); await settle();
  assert.equal(calls, 4);
  assert.equal(received.at(-1).visible, false);

  // 4. 确认任务结束后再次休眠停机
  t.mock.timers.tick(5000); await settle();
  assert.equal(calls, 4, '任务完成后立即休眠，不再继续轮询');
  handle.dispose();
});

test('watchComposerConfiguration 失败与成功准确回调错误状态，支持布尔/无参数消费以适配动态国际化', async () => {
  let calls = 0;
  const errors = [];
  const watcher = watchComposerConfiguration({
    getGlobal: () => ++calls === 1 ? Promise.reject(new Error('fail')) : ok({ values: { enabled: true } }),
    getSession: () => ok({ values: { enabled: true } }),
  }, 'dyn-lang', () => {}, () => {}, err => errors.push(err));
  await settle();
  assert.equal(errors.length, 1);
  assert.equal(Boolean(errors[0]), true, '首次失败应传递真值错误');
  watcher.refresh();
  await settle();
  assert.equal(errors.length, 2);
  assert.equal(Boolean(errors[1]), false, '刷新成功后应清除错误标记');
  watcher.dispose();
});

test('配置读取连续失败时快速退避后转 30s 低频兜底，成功后退避重置为常速', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  let healthy = false;
  const watcher = watchComposerConfiguration({
    getGlobal: () => {
      calls++;
      return healthy ? ok({ values: { enabled: true } }) : Promise.resolve({ ok: false, error: { message: '宿主设置服务尚未就绪' } });
    },
    getSession: () => ok({ values: { enabled: true } }),
  }, 'flaky-session', () => {}, () => {});
  await settle();
  assert.equal(calls, 1);
  t.mock.timers.tick(250); await settle(); assert.equal(calls, 2);
  t.mock.timers.tick(500); await settle(); assert.equal(calls, 3);
  t.mock.timers.tick(1000); await settle(); assert.equal(calls, 4);
  t.mock.timers.tick(2000); await settle(); assert.equal(calls, 5);
  // 快速退避耗尽后不得停在 4s 短周期，也不得彻底放弃
  t.mock.timers.tick(4000); await settle(); assert.equal(calls, 5, '快速退避阶段结束后不应在 4s 内继续请求');
  t.mock.timers.tick(26000); await settle();
  assert.equal(calls, 6, '30s 低频兜底必须重新尝试，否则读取失败后入口永久不恢复');
  // 兜底尝试成功 → 退避回到常速，下一次失败仍走 250ms 快速重试
  healthy = true;
  t.mock.timers.tick(30000); await settle(); assert.equal(calls, 7);
  healthy = false;
  watcher.refresh(); await settle(); assert.equal(calls, 8);
  t.mock.timers.tick(250); await settle(); assert.equal(calls, 9, '成功后退避必须重置为 250ms');
  watcher.dispose();
});
