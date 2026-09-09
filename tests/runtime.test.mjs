import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { AgentRegistry } from '@deepseek-ai/dsh-agent';
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop';
import { CommandRuntime } from '@deepseek-ai/dsh-commands';
import { LlmAdapter, LlmRuntime, createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionStore, Session } from '@deepseek-ai/dsh-session';
import { LocalSubprocessRuntime } from '@deepseek-ai/dsh-subprocess-local';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { SettingsProvider } from '@deepseek-ai/dsh-settings';
import { HookContent } from '../lib/hook-content.js';
import { SourceCatalog } from '../lib/source.js';
import { FLAVORS } from '../lib/flavors.js';
import { isTerminalFailure, PuaRuntime, verifyLoop } from '../lib/runtime.js';
import { StateStore } from '../lib/state.js';
import { parseArgs } from '../lib/args.js';
import * as plugin from '../lib/index.js';

async function setup(t, reply = () => '离线测试回复', settings = false) {
  const requests = [];
  class OfflineAdapter extends LlmAdapter {
    async *stream(options) {
      requests.push(options);
      const text = await reply(requests.length, options);
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text };
      yield { type: 'block-end', index: 0, block: { type: 'text', text } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  new SessionStore(ctx); new AgentRegistry(ctx); new SessionProjectionRegistry(ctx);
  new LlmRuntime(ctx); new SystemPrompt(ctx, { includeHarnessIdentity: false });
  new ToolRuntime(ctx); new CommandRuntime(ctx); new AgentLoop(ctx, { agents: [] });
  if (settings) {
    class MemorySettings extends SettingsProvider {
      writable = true;
      async load() { return {}; }
      async persist() {}
    }
    new MemorySettings(ctx);
  }
  ctx.llm.registerAdapter(['offline-pua-test'], new OfflineAdapter());
  const installed = ctx.plugin(plugin);
  await installed.await();
  const create = async id => {
    const handle = await ctx.agents.create({ sessionId: id, meta: { cwd: process.cwd() }, agentOptions: { provider: 'offline-pua-test', model: 'fixed-response' } });
    t.after(() => handle.dispose());
    return handle.agent;
  };
  const agent = await create('runtime-test');
  const run = (line, target = agent) => ctx.commands.execute(target, line, [], new AbortController().signal);
  const say = async (text, target = agent) => { target.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await target.whenIdle(); };
  return { ctx, agent, run, say, create, requests, installed };
}

test('原版 hook 四级模板、15 风味均可展开；候选保留条件门控和锁定边界', () => {
  const hooks = new HookContent(new SourceCatalog());
  for (const flavor of FLAVORS) for (const flavorLocked of [true, false]) {
    const state = { flavor: flavor.id, flavorLocked };
    assert.match(hooks.frustrationPrompt(state), /User Frustration Signal/);
    for (const count of [2, 3, 4, 5]) {
      const text = hooks.candidate(count, state);
      assert.match(text, /Candidate Only/);
      assert.match(text, /不是本任务\/子目标失败计数/);
      assert.doesNotMatch(text, /\$\{/);
      if (flavorLocked) assert.match(text, /locked|user-selected|user lock/i);
    }
  }
  assert.match(hooks.frustrationPrompt({ flavor: 'huawei', flavorLocked: true }), /我先立军令状/);
});

test('只识别真实终端失败，排除文本伪造、嵌套退出码、取消和拒绝', () => {
  const ok = value => ({ isError: false, value, content: [] });
  for (const value of [{ stdout: 'exitCode: 1 error failed' }, { nested: { exitCode: 1 } }, { exitCode: 0 }, { exitCode: '1' }]) assert.equal(isTerminalFailure(ok(value)), false);
  assert.equal(isTerminalFailure(ok({ exitCode: 1 })), true);
  for (const code of ['ABORTED', 'ABORTED_BEFORE_DISPATCH', 'PERMISSION_DENIED', 'APPROVAL_DENIED']) assert.equal(isTerminalFailure({ isError: true, error: { message: 'failed', info: { code } } }), false);
});

test('Loop 参数保留 Windows 路径，拒绝未闭合引号和重复选项', () => {
  const action = parseArgs('loop "修复测试" --verify "node D:\\tools\\check.js" --max-iterations 5');
  assert.equal(action.verify, 'node D:\\tools\\check.js');
  for (const text of ['loop "任务', 'loop task --verify "unclosed', 'loop task --verify a --verify b', 'loop task --max-iterations 1 --max-iterations 2']) assert.throws(() => parseArgs(text));
});

test('settings 自动开启、schema 可发现、风味默认持久化；会话 off 优先', async t => {
  const { ctx, agent, run, say, create, requests, installed } = await setup(t, undefined, true);
  assert.equal(ctx.settings.describe().find(item => item.ns === 'michengai-pua').value.alwaysOn, true);
  await say('初始任务');
  assert.match(requests.at(-1).system, /风味未锁定/);
  await run('/pua flavor huawei');
  assert.equal(ctx.settings.get('michengai-pua').flavor, 'huawei');
  const second = await create('new-session');
  await say('另一个任务', second);
  assert.match(requests.at(-1).system, /用户锁定风味：huawei/);
  await run('/pua off');
  await ctx.settings.update('michengai-pua', { alwaysOn: true, flavor: 'auto' });
  await say('再试试', agent);
  assert.match(requests.at(-1).system, /已关闭/);
  assert.doesNotMatch(JSON.stringify(requests.at(-1).messages.at(-1)), /User Frustration Signal/);
  await installed.dispose();
  assert.equal(ctx.settings.describe().some(item => item.ns === 'michengai-pua'), false);
});

test('资料工具真实注册、读取完整正文、拒绝脚本与越界，卸载后消失', async t => {
  const { ctx, agent, installed } = await setup(t);
  const execute = path => ctx.tools.execute({ name: 'pua_reference', arguments: { path }, agent, callId: path, signal: new AbortController().signal });
  const full = await execute('skills/pua/SKILL.md');
  assert.equal(full.value, new SourceCatalog().read('skills/pua/SKILL.md'));
  for (const path of ['../../package.json', 'hooks/failure-detector.sh']) assert.equal((await execute(path)).isError, true);
  await installed.dispose();
  assert.equal(ctx.tools.get('pua_reference'), undefined);
});

test('候选失败只在开启后注入，调用去重、成功不清零、关停不再次注入', async t => {
  const { ctx, agent, run, say, requests } = await setup(t);
  ctx.tools.register({ name: 'bash', description: '测试终端', parameters: { type: 'object' }, output: { schema: { type: 'object', properties: { exitCode: { type: 'integer' } }, required: ['exitCode'] }, render: (_, value) => [{ type: 'text', text: JSON.stringify(value) }] }, execute: async args => args });
  const execute = (callId, exitCode = 1) => ctx.tools.execute({ name: 'bash', arguments: { exitCode }, agent, callId, signal: new AbortController().signal });
  await run('/pua on'); await run('/pua flavor huawei');
  await execute('failure-1'); await execute('failure-1'); await execute('success', 0);
  assert.match((await run('/pua status')).result.text, /终端失败观察：1/);
  await execute('failure-2');
  await say('继续');
  assert.match(JSON.stringify(requests.at(-1)), /PUA Candidate L1/);
  assert.match(JSON.stringify(requests.at(-1)), /我先立军令状/);
  await run('/pua off'); await execute('failure-3');
  assert.match((await run('/pua status')).result.text, /终端失败观察：2/);
});

test('真正停止边界继续 Loop；Oracle 拒绝后再验收通过，记录可回放', { timeout: 10000 }, async t => {
  const { ctx, agent, run, requests } = await setup(t, () => '<promise>LOOP_DONE</promise>');
  let checks = 0;
  ctx.provide('subprocess', { spawn(spec) {
    checks++;
    assert.ok(spec.argv.includes('npm test\nif (-not $?) { exit 1 }; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }') || spec.argv.some(arg => arg.includes('npm test')));
    return { done: Promise.resolve({ exitCode: checks === 1 ? 1 : 0, signal: null }), collected: { stdout: { readFrom: () => ({ text: checks === 1 ? '真实测试失败' : '通过', lossy: false }) } } };
  } });
  assert.equal((await run('/pua loop "修复测试" --verify "npm test" --max-iterations 4')).result.kind, 'success');
  await agent.whenIdle();
  assert.equal(checks, 2);
  assert.equal(requests.length, 2);
  assert.match(JSON.stringify(requests[1]), /PROMISE 被 Oracle 拒绝/);
  for (const request of requests) assert.doesNotMatch(JSON.stringify(request.messages), /PUA_RUNTIME_V1|"failureCount"|"failures"/);
  assert.match(JSON.stringify(requests[0].messages), /PUA_LOOP_START.*npm test/);
  assert.match((await run('/pua status')).result.text, /Loop：complete.*Oracle 拒绝 1 次/);
  assert.ok(agent.session.snapshotEvents().some(event => event.type === 'user/message' && JSON.stringify(event.data).includes('Oracle 独立验收通过')));
  // 脱离插件重建宿主上下文，替换关系仍然有效，完整状态仍可回放。
  const restored = Session.create('oracle-restored', JSON.parse(JSON.stringify(agent.session.snapshotEvents())));
  assert.doesNotMatch(JSON.stringify(restored.deriveMessages()), /PUA_RUNTIME_V1/);
});

test('旧版 RECORD 在下一次请求前替换，保留用户同名文本和历史状态', async t => {
  const { agent, say, run, requests } = await setup(t);
  const record = 'PUA_RUNTIME_V1 ' + JSON.stringify({ failureCount: 2, failures: ['legacy-call'] }) + '\n旧运行说明';
  agent.session.append('user/message', createUserMessage({ content: [{ type: 'text', text: record }], source: { kind: 'plugin', plugin: '@michengai/dsh-pua/runtime' } }), { surfaceOp: 'append' });
  await say('普通任务');
  assert.doesNotMatch(JSON.stringify(requests.at(-1).messages), /PUA_RUNTIME_V1|legacy-call/);
  // 新建运行实例验证兼容恢复，避免依赖当前实例已经初始化的缓存。
  const context = new Context();
  t.after(() => context.fiber.dispose());
  const runtime = new PuaRuntime(context, new StateStore(), new SourceCatalog(), new AbortController().signal);
  assert.equal(runtime.read(agent.session).failureCount, 2);
  await say('PUA_RUNTIME_V1 是什么？');
  assert.match(JSON.stringify(requests.at(-1).messages), /PUA_RUNTIME_V1 是什么/);
  assert.equal((await run('/pua status')).result.kind, 'success');
});

test('hook 模板结构变化时明确报错；首次失败遵循原版不注入', () => {
  const catalog = new SourceCatalog();
  const state = { flavor: 'alibaba', flavorLocked: false };
  assert.equal(new HookContent(catalog).candidate(1, state), '');
  for (const marker of ['EOF_GATE', 'EOF_ROUTING', 'EOF_OUTPUT', 'FLAVOR_CONTEXT']) {
    const modified = { read: path => catalog.read(path).replaceAll(marker, 'REMOVED_' + marker) };
    assert.throws(() => new HookContent(modified).candidate(2, state), /原版失败候选模板结构不匹配/);
  }
});

test('真实 Windows Oracle 保留双引号、反引号、换行及带空格路径', { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const subprocess = new LocalSubprocessRuntime(ctx);
  const cases = [
    ['Write-Output "a b"', 'a b'],
    ['Write-Output "a`"b"', 'a"b'],
    ['Write-Output "a`nb"', 'a\nb'],
    ['"a b" | findstr /c:"a b"', 'a b'],
    ['& "$env:SystemRoot\\System32\\where.exe" "powershell.exe"', process.env.SystemRoot + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'],
    ['if (-not (Test-Path -LiteralPath "$env:ProgramFiles")) { exit 9 }; Write-Output "space path OK"', 'space path OK'],
  ];
  for (const [command, expected] of cases) {
    const result = await verifyLoop(subprocess, command, process.cwd(), new AbortController().signal);
    assert.equal(result.ok, true, result.detail);
    assert.equal(JSON.parse(result.detail).stdout.replaceAll('\r\n', '\n').trim(), expected);
  }
});

test('无 Oracle 如实记录 honor system；轮次上限阻止无限续轮', async t => {
  const { agent, run, requests } = await setup(t, number => number <= 2 ? '还没完成' : '<promise>LOOP_DONE</promise>');
  await run('/pua loop "测试上限" --max-iterations 2');
  await agent.whenIdle();
  assert.equal(requests.length, 2);
  assert.match((await run('/pua status')).result.text, /max_reached/);
  await run('/pua loop "无 Oracle 测试"');
  await agent.whenIdle();
  assert.match((await run('/pua status')).result.text, /complete/);
  assert.ok(agent.session.snapshotEvents().some(event => event.type === 'user/message' && JSON.stringify(event.data).includes('不是独立验证通过')));
});

test('Oracle 等待期间 off 取消验证；不续轮、不把取消当失败', { timeout: 5000 }, async t => {
  const { ctx, agent, run, requests } = await setup(t, () => '<promise>LOOP_DONE</promise>');
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  let verifierSignal;
  ctx.provide('subprocess', { spawn(spec) {
    verifierSignal = spec.signal;
    const done = new Promise(resolve => spec.signal.addEventListener('abort', () => resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true }));
    entered();
    return { done, collected: {} };
  } });
  await run('/pua loop "测试取消" --verify "npm test"');
  await ready;
  await run('/pua off');
  await agent.whenIdle();
  assert.equal(verifierSignal.aborted, true);
  assert.equal(requests.length, 1);
  assert.match((await run('/pua status')).result.text, /cancelled.*Oracle 拒绝 0 次/);
});

test('暂停可回放但不跨分叉自动运行；用户补充后恢复同会话', async t => {
  const { agent, run, say, requests } = await setup(t, number => number === 1 ? '<loop-pause>需要配置</loop-pause>' : '<promise>LOOP_DONE</promise>');
  await run('/pua loop "暂停恢复" --max-iterations 3');
  await agent.whenIdle();
  assert.match((await run('/pua status')).result.text, /paused/);
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const runtime = new PuaRuntime(ctx, new StateStore(), new SourceCatalog(), new AbortController().signal);
  const events = JSON.parse(JSON.stringify(agent.session.snapshotEvents()));
  const restored = Session.create('restored', events, { ...agent.session.header, id: 'restored' });
  const fork = Session.create('fork', events, { ...agent.session.header, id: 'fork', parentSession: agent.id, isSeeded: true }, events.length);
  assert.equal(runtime.read(restored).loop.status, 'paused');
  assert.equal(runtime.read(fork).loop, undefined);
  await say('配置已补充，继续');
  assert.equal(requests.length, 2);
  assert.match((await run('/pua status')).result.text, /complete/);
});

test('取消别名覆盖尚未开始的 Loop，不能由排队的旧请求复活', { timeout: 5000 }, async t => {
  let entered, release;
  const ready = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const { agent, run, requests } = await setup(t, async number => {
    if (number === 1) { entered(); await wait; }
    return '普通回复';
  });
  await run('/pua 普通任务');
  await ready;
  await run('/pua loop "排队任务" --max-iterations 5');
  await run('/cancel-pua-loop');
  release();
  await agent.whenIdle();
  assert.equal(requests.length, 2);
  assert.match((await run('/pua status')).result.text, /Loop：未启动/);
  assert.match(requests[1].system, /当前 DSH 模式：pua。/);
});

test('用户取消及卸载取消活动 Loop，不在下一条普通输入时恢复', { timeout: 5000 }, async t => {
  for (const mode of ['user', 'unload']) {
    let entered, release;
    const ready = new Promise(resolve => { entered = resolve; });
    const wait = new Promise(resolve => { release = resolve; });
    const { agent, run, requests, installed, ctx, say } = await setup(t, async number => {
      if (number === 1) { entered(); await wait; }
      return '尚未完成';
    });
    await run('/pua loop "取消测试" --max-iterations 5');
    await ready;
    if (mode === 'user') agent.cancel({ kind: 'user' });
    else await installed.dispose();
    release();
    await agent.whenIdle();
    assert.equal(requests.length, 1);
    if (mode === 'unload') await ctx.plugin(plugin).await();
    await say('普通输入');
    assert.equal(requests.length, 2);
    assert.match(requests[1].system, /当前 DSH 模式：pua。/);
    assert.match((await run('/pua status')).result.text, /cancelled/);
  }
});

test('真实 PowerShell Oracle：非零退出码、命令不存在与超时都不会误判成功', { timeout: 15000 }, async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const subprocess = new LocalSubprocessRuntime(ctx);
  const signal = new AbortController().signal;
  assert.equal((await verifyLoop(subprocess, 'exit 0', process.cwd(), signal)).ok, true);
  assert.equal((await verifyLoop(subprocess, 'exit 7', process.cwd(), signal)).ok, false);
  assert.equal((await verifyLoop(subprocess, 'pua_nonexistent_command_for_test', process.cwd(), signal)).ok, false);
  const timeout = await verifyLoop(subprocess, 'Start-Sleep -Seconds 30', process.cwd(), signal, 100);
  assert.equal(timeout.ok, false);
  assert.match(timeout.detail, /timedOut.*true|超时/);
});

test('反馈只依据可见旁白，不唤醒模型；离线模式关闭提醒', async t => {
  const { ctx, agent, run, say, requests } = await setup(t, () => '[PUA-DIAGNOSIS] 可见诊断及交付', true);
  await ctx.settings.update('michengai-pua', { feedbackFrequency: 1 });
  await say('完成任务');
  const reminders = () => agent.session.deriveMessages().filter(message => JSON.stringify(message).includes('PUA 本地反馈（自愿）'));
  assert.equal(reminders().length, 1);
  assert.equal(requests.length, 1);
  await run('/pua offline');
  await say('另一个任务');
  assert.equal(reminders().length, 1);
  assert.equal(requests.length, 2);
});

test('压缩生命周期保留观察，clear 清除计数且不复活旧循环', async t => {
  const { ctx, agent, run } = await setup(t);
  await run('/pua on');
  ctx.tools.register({ name: 'bash', description: '测试', parameters: { type: 'object' }, output: { schema: { type: 'integer' }, render: () => [] }, execute: async () => { throw new Error('失败'); } });
  await ctx.tools.execute({ name: 'bash', arguments: {}, agent, callId: 'clear-failure', signal: new AbortController().signal });
  assert.match((await run('/pua status')).result.text, /终端失败观察：1/);
  ctx.emit('agent/session-start', { agent, source: 'compact' });
  assert.match((await run('/pua status')).result.text, /终端失败观察：1/);
  ctx.emit('agent/session-start', { agent, source: 'clear' });
  assert.match((await run('/pua status')).result.text, /终端失败观察：0.*未启动/);
});

test('连续排队Loop只允许最新命令启动循环，旧任务不会恢复旧配置', { timeout: 5000 }, async t => {
  let entered, release;
  const ready = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const { agent, run, requests } = await setup(t, async number => {
    if (number === 1) { entered(); await wait; }
    return '继续处理';
  });
  await run('/pua 普通任务');
  await ready;
  await run('/pua loop "旧任务" --max-iterations 2');
  await run('/cancel-pua-loop');
  await run('/pua loop "最新任务" --max-iterations 2');
  release();
  await agent.whenIdle();
  assert.equal(requests.length, 4);
  const starts = agent.session.snapshotEvents().filter(event => event.type === 'user/message' && event.surfaceOp === 'append' && JSON.stringify(event.data).includes('显式启动 Loop；验证配置以用户命令为准。'));
  assert.equal(starts.length, 1);
  assert.match(JSON.stringify(starts[0]), /最新任务/);
});
