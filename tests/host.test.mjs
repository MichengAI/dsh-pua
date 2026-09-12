import test from 'node:test';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { CommandRuntime } from '@deepseek-ai/dsh-commands';
import { Session, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session';
import { SystemPrompt, renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import * as plugin from '../lib/index.js';

async function setup(t) {
  const ctx = new Context();
  new CommandRuntime(ctx);
  new SystemPrompt(ctx, { includeHarnessIdentity: false });
  const installed = ctx.plugin(plugin);
  await installed.await();
  t.after(() => ctx.fiber.dispose());
  return { ctx, installed };
}

function agent(id = 'a', seed = [], extra = {}, inherited = 0) {
  const header = { id, version: SESSION_FORMAT_VERSION, createdAt: 1, cwd: resolve('工作区'), isSeeded: inherited > 0, ...extra };
  const session = Session.create(id, seed, header, inherited);
  const messages = [];
  return { id, session, messages, followup: m => messages.push({ mode: 'followup', ...m }), steer: m => messages.push({ mode: 'steer', ...m }) };
}

const run = (ctx, a, line, signal = new AbortController().signal) => ctx.commands.execute(a, line, [], signal);
const prompt = async (ctx, a) => {
  const assembly = await ctx.systemPrompt.assemble({ agent: a });
  return renderPrompt(assembly);
};

test('真实命令和提示词服务：默认关闭、显式激活、选择风味、关闭、卸载', async t => {
  const { ctx, installed } = await setup(t);
  const a = agent();
  assert.equal(await prompt(ctx, a), '');
  assert.equal((await run(ctx, a, '/pua flavor huawei')).result.kind, 'success');
  assert.equal(a.messages.length, 0);
  assert.equal((await run(ctx, a, '/pua 修复登录')).result.kind, 'success');
  assert.equal(a.messages[0].mode, 'followup');
  assert.equal(a.messages[0].source.plugin, '@michengai/dsh-pua');
  assert.match(a.messages[0].content[0].text, /修复登录/);
  const active = await prompt(ctx, a);
  assert.match(active, /华为/);
  assert.match(active, /PUA-DIAGNOSIS/);
  assert.doesNotMatch(active, /## 2\. 🟡 字节味/);
  assert.equal((await run(ctx, a, '/pua off')).result.kind, 'success');
  assert.match(await prompt(ctx, a), /已关闭/);
  assert.doesNotMatch(await prompt(ctx, a), /军令状/);
  assert.equal(a.messages.length, 1);
  await installed.dispose();
  assert.equal(ctx.commands.find(a, 'pua'), undefined);
  assert.equal(await prompt(ctx, a), '');
});

test('隔离与恢复：相同目录的不同会话不串状态，同会话重建恢复，分叉不继承', async t => {
  const { ctx } = await setup(t);
  const a = agent('a');
  await run(ctx, a, '/pua on');
  await run(ctx, a, '/pua flavor huawei');
  assert.equal(await prompt(ctx, agent('b')), '');
  const history = JSON.parse(JSON.stringify(a.session.snapshotEvents()));
  const restored = agent('a', history);
  assert.match(await prompt(ctx, restored), /军令状/);
  const fork = agent('fork', history, { parentSession: 'a' }, history.length);
  assert.match(await prompt(ctx, fork), /已关闭/);
  assert.doesNotMatch(await prompt(ctx, fork), /军令状/);
  await run(ctx, restored, '/pua off');
  assert.match(await prompt(ctx, a), /军令状/);
});

test('空命令与质量入口投递当前步骤；开关、状态和帮助不发起模型调用', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  for (const command of ['on', 'status', 'help', 'flavor', 'off']) {
    assert.equal((await run(ctx, a, `/pua ${command}`)).result.kind, 'success');
  }
  assert.equal(a.messages.length, 0);
  for (const command of ['', 'again', 'done-check', 'evidence']) {
    assert.equal((await run(ctx, a, `/pua ${command}`)).result.kind, 'success');
  }
  assert.equal(a.messages.length, 4);
  assert.ok(a.messages.every(m => m.mode === 'steer'));
  assert.match(a.messages[2].content[0].text, /验收/);
  assert.match(a.messages[3].content[0].text, /证据/);
});

test('取消、参数错误和投递失败不激活；失败状态不在重启后恢复', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  for (const command of ['/pua flavor ../../secret', '/pua off all']) {
    assert.equal((await run(ctx, a, command)).result.kind, 'error');
  }
  const aborted = AbortSignal.abort();
  await assert.rejects(() => run(ctx, a, '/pua on', aborted));
  a.steer = () => { throw new Error('入队失败'); };
  assert.equal((await run(ctx, a, '/pua')).result.kind, 'error');
  assert.equal(await prompt(ctx, a), '');
  assert.equal(await prompt(ctx, agent('a', a.session.snapshotEvents())), '');
});

test('并发命令保持先后状态，不恢复未完成的命令', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  await Promise.all([run(ctx, a, '/pua on'), run(ctx, a, '/pua flavor huawei'), run(ctx, a, '/pua off')]);
  assert.match(await prompt(ctx, a), /已关闭/);
  const restored = agent('a', a.session.snapshotEvents());
  assert.match(await prompt(ctx, restored), /已关闭/);
  restored.session.append('command/run', { commandId: 'incomplete', name: 'pua', args: ' on', source: { kind: 'user' } });
  assert.match(await prompt(ctx, restored), /已关闭/);
});

test('误输入不唤醒或激活；重复前缀风味列表不被发成任务', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  for (const line of ['/pua in', '/pua onn', '/pua loop']) assert.equal((await run(ctx, a, line)).result.kind, 'error');
  assert.equal((await run(ctx, a, '/pua pua flavor')).result.kind, 'success');
  assert.equal(a.messages.length, 0);
  assert.equal(await prompt(ctx, a), '');
});

test('升级后按历史成功结果恢复旧版误输入，不用新语法重写既有开关', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  a.session.append('command/run', { commandId: 'legacy', name: 'pua', args: ' pua flavor', source: { kind: 'user' } });
  a.session.append('command/done', { commandId: 'legacy', kind: 'success', text: 'PUA · 已提交任务请求，风味：阿里。请查看 Agent 后续结果。' });
  assert.match(await prompt(ctx, a), /PUA-DIAGNOSIS/);
  await run(ctx, a, '/pua off');
  assert.match(await prompt(ctx, a), /已关闭/);
});

test('原版快速入口的输出协议进入实际投递内容', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  await run(ctx, a, '/pua again');
  assert.match(a.messages[0].content[0].text, /路径 A/);
  assert.match(a.messages[0].content[0].text, /路径 B/);
  await run(ctx, a, '/pua done-check');
  for (const key of ['claim', 'evidence', 'missing', 'done_with_evidence']) assert.ok(a.messages[1].content[0].text.includes(key));
  await run(ctx, a, '/pua evidence');
  assert.match(a.messages[2].content[0].text, /needs_check/);
});

test('审查入口发送只读任务，缺少 Git 服务时明确标注证据不可用', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  assert.equal((await run(ctx, a, '/pua review')).result.kind, 'success');
  assert.equal(a.messages.length, 1);
  assert.equal(a.messages[0].mode, 'followup');
  assert.match(a.messages[0].content[0].text, /只读审查/);
  assert.match(a.messages[0].content[0].text, /未获取 Git 证据/);
});

function delayedSubprocess(ctx) {
  let release;
  let start;
  const started = new Promise(resolve => { start = resolve; });
  ctx.provide('subprocess', { spawn: spec => {
    const done = new Promise(resolve => {
      release = () => resolve({ exitCode: 0, signal: null });
      spec.signal.addEventListener('abort', () => resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true });
    });
    start();
    // 空根目录使预检停止，便于精确控制唯一的异步等待点。
    return { done, collected: { stdout: { readFrom: () => ({ text: '', lossy: false }) } } };
  } });
  return { started, release: () => release() };
}

test('审查预检等待期间不激活；晚到的 off 在审查完成及重建后仍生效', async t => {
  const { ctx } = await setup(t);
  const delayed = delayedSubprocess(ctx);
  const a = agent();
  const reviewing = run(ctx, a, '/pua review');
  await delayed.started;
  assert.equal(await prompt(ctx, a), '');
  await run(ctx, a, '/pua off');
  delayed.release();
  assert.equal((await reviewing).result.kind, 'success');
  assert.equal(a.messages.length, 1);
  assert.match(await prompt(ctx, a), /已关闭/);
  assert.match(await prompt(ctx, agent('restored', a.session.snapshotEvents())), /已关闭/);
});

test('预检期间取消或卸载，不投递任务且不恢复开启状态', async t => {
  for (const mode of ['cancel', 'unload']) {
    const { ctx, installed } = await setup(t);
    const delayed = delayedSubprocess(ctx);
    const a = agent();
    const cancel = new AbortController();
    const reviewing = run(ctx, a, '/pua review', cancel.signal);
    await delayed.started;
    if (mode === 'cancel') cancel.abort();
    else await installed.dispose();
    if (mode === 'cancel') await assert.rejects(reviewing, { name: 'AbortError' });
    else assert.equal((await reviewing).result.kind, 'error');
    assert.equal(a.messages.length, 0);
    assert.equal(await prompt(ctx, a), '');
    if (mode === 'unload') await ctx.plugin(plugin).await();
    assert.equal(await prompt(ctx, agent('restored', a.session.snapshotEvents())), '');
  }
});
