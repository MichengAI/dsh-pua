import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../lib/args.js';

test('默认、控制命令、中文风味和多行任务', () => {
  assert.deepEqual(parseArgs(''), { kind: 'activate', task: '' });
  assert.deepEqual(parseArgs(' on '), { kind: 'on' });
  assert.deepEqual(parseArgs('flavor 华为'), { kind: 'flavor', flavor: 'huawei' });
  assert.deepEqual(parseArgs('flavor Musk'), { kind: 'flavor', flavor: 'tesla' });
  assert.deepEqual(parseArgs('flavor'), { kind: 'flavors' });
  assert.deepEqual(parseArgs('修复登录\n保留接口'), { kind: 'activate', task: '修复登录\n保留接口' });
  assert.deepEqual(parseArgs('-- on feature'), { kind: 'activate', task: 'on feature' });
});

test('错误参数不退化成模型任务，限制输入体积', () => {
  for (const input of ['off all', 'on later', 'status x', 'flavor ../../secret', 'flavor huawei extra', '--invalid', '--', 'a\0b', '中'.repeat(3000)]) {
    assert.throws(() => parseArgs(input), undefined, input.slice(0, 40));
  }
});

test('真实误输入回归：重复前缀只路由一次，疑似控制命令不发起任务', () => {
  assert.deepEqual(parseArgs('pua flavor'), { kind: 'flavors' });
  assert.deepEqual(parseArgs('/pua flavor 华为'), { kind: 'flavor', flavor: 'huawei' });
  assert.deepEqual(parseArgs('/pua:off'), { kind: 'off' });
  for (const value of ['in', 'onn', 'of', 'flavour', 'stauts', 'pua pua flavor', 'loop']) assert.throws(() => parseArgs(value), undefined, value);
  assert.deepEqual(parseArgs('cancel-loop'), { kind: 'cancel-pua-loop' });
  assert.deepEqual(parseArgs('pua-cancel-loop'), { kind: 'cancel-pua-loop' });
  assert.deepEqual(parseArgs('cancel-pua-loop'), { kind: 'cancel-pua-loop' });
  assert.deepEqual(parseArgs('-- in'), { kind: 'activate', task: 'in' });
  assert.deepEqual(parseArgs('implement login'), { kind: 'activate', task: 'implement login' });
});

test('原版中文快捷入口与审查请求保留明确路由', () => {
  assert.deepEqual(parseArgs('换个方法'), { kind: 'again' });
  assert.deepEqual(parseArgs('证据呢'), { kind: 'evidence' });
  assert.deepEqual(parseArgs('没跑测试别说完成'), { kind: 'done-check' });
  assert.deepEqual(parseArgs('味道 华为'), { kind: 'flavor', flavor: 'huawei' });
  assert.deepEqual(parseArgs('review 权限边界'), { kind: 'review', task: '权限边界' });
  assert.deepEqual(parseArgs('审查一下项目'), { kind: 'review', task: '审查一下项目' });
  assert.deepEqual(parseArgs('审查一下项目，然后修复问题'), { kind: 'activate', task: '审查一下项目，然后修复问题' });
});
