import test from 'node:test';
import assert from 'node:assert/strict';
import PuaRemote from '../lib/remote.js';

test('状态卡片只反映当前运行任务，历史 Loop 不唤起卡片，关闭开关立即隐藏', () => {
  let status = 'idle', global = true, enabled = true;
  const activity = { verifying: false, failureCount: 2, loop: { iteration: 3, maxIterations: 5, rejections: 1 } };
  const session = {};
  const target = {
    agent: () => ({ session, get status() { return status; } }),
    ctx: { puaConfiguration: {
      preferences: { configuration: () => ({ enabled: global }) },
      store: { configuration: () => ({ enabled, mode: 'p9', flavor: 'auto', subagents: false }) },
      runtime: { activity: () => activity },
    } },
  };
  const read = () => PuaRemote.prototype.getActivity.call(target, 'a');
  assert.equal(read().visible, false);
  status = 'running'; assert.equal(read().visible, true);
  assert.deepEqual(read().loop, activity.loop);
  assert.deepEqual(read().configuration, { mode: 'p9', flavor: 'auto', subagents: false });
  enabled = false; assert.equal(read().visible, false);
  enabled = true; global = false; assert.equal(read().visible, false);
  global = true; status = 'idle'; assert.equal(read().visible, false);
  activity.verifying = true; assert.equal(read().visible, true);
});
