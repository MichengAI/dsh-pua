// 从模型发起工具调用，验证真正进入下一轮请求的消息顺序与历史兼容。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// 指定 profile 时复用已安装包及其依赖，只创建内存会话，不读取用户历史。
const profile = process.env.PUA_TEST_PROFILE;
const installedRequire = profile ? createRequire(createRequire(join(profile, 'package.json')).resolve('@michengai/dsh-pua')) : undefined;
const load = specifier => import(installedRequire ? pathToFileURL(installedRequire.resolve(specifier)).href : specifier);
const local = file => load(installedRequire ? './' + file : '../lib/' + file);
const [{ Context }, { AgentRegistry }, { AgentLoop }, { CommandRuntime },
  { LlmAdapter, LlmRuntime, createUserMessage, createAssistantMessage, createToolResultMessage },
  { SessionStore, Session }, { SessionProjectionRegistry }, { SystemPrompt }, { ToolRuntime },
  { PuaRuntime }, { StateStore }, { SourceCatalog }, plugin] = await Promise.all([
  ...['cordis', 'dsh-agent', 'dsh-agent-loop', 'dsh-commands', 'dsh-llm', 'dsh-session',
    'dsh-session-projection', 'dsh-system-prompt', 'dsh-tools'].map(name => load('@deepseek-ai/' + name)),
  ...['runtime.js', 'state.js', 'source.js', 'index.js'].map(local),
]);

const textMessage = (text, source = { kind: 'user' }) => createUserMessage({ content: [{ type: 'text', text }], source });
const runtimeSource = { kind: 'plugin', plugin: '@michengai/dsh-pua/runtime' };
const isRuntime = message => message.source.kind === 'plugin' && message.source.plugin === runtimeSource.plugin;
function assertToolOrder(messages) {
  const pending = new Set();
  for (const message of messages) {
    if (pending.size) assert.equal(message.source.kind, 'tool', '工具结果完整返回前不能出现普通消息');
    for (const block of message.content) {
      if (block.type === 'tool-call') pending.add(block.id);
      if (block.type === 'tool-result') {
        assert.ok(pending.delete(block.toolCallId), '工具结果必须对应唯一的待完成调用');
      }
    }
  }
  assert.equal(pending.size, 0, '不得遗失工具结果');
}

async function setup(t, { count = 1, seed, inherited = false, execute = async () => ({ exitCode: 1 }) } = {}) {
  const requests = [];
  class OfflineAdapter extends LlmAdapter {
    async *stream(options) {
      requests.push(options);
      if (!seed && requests.length === 1) {
        for (let index = 0; index < count; index++) {
          const block = { type: 'tool-call', id: 'ordered-' + index, name: 'bash', arguments: JSON.stringify({ index }) };
          yield { type: 'block-start', index, blockType: 'tool-call' };
          yield { type: 'tool-call-delta', index, id: block.id, name: block.name, argumentsDelta: block.arguments };
          yield { type: 'block-end', index, block };
        }
        yield { type: 'finish', reason: { kind: 'tool-calls' } };
      } else {
        const text = '离线任务结束';
        yield { type: 'block-start', index: 0, blockType: 'text' };
        yield { type: 'text-delta', index: 0, text };
        yield { type: 'block-end', index: 0, block: { type: 'text', text } };
        yield { type: 'finish', reason: { kind: 'stop' } };
      }
    }
  }
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  new SessionStore(ctx); new AgentRegistry(ctx); new SessionProjectionRegistry(ctx);
  new LlmRuntime(ctx); new SystemPrompt(ctx, { includeHarnessIdentity: false });
  new ToolRuntime(ctx); new CommandRuntime(ctx); new AgentLoop(ctx, { agents: [] });
  ctx.llm.registerAdapter(['offline-order-test'], new OfflineAdapter());
  ctx.tools.register({ name: 'bash', description: '内存终端夹具', parameters: { type: 'object' }, isConcurrencySafe: () => true,
    output: { schema: { type: 'object' }, render: (_, value) => [{ type: 'text', text: JSON.stringify(value) }] }, execute });
  const installed = ctx.plugin(plugin);
  await installed.await();
  const handle = await ctx.agents.create({ sessionId: 'order-test', seed,
    ...(inherited ? { meta: { parentSession: 'parent', isSeeded: true }, inheritedEventCount: seed.length } : {}),
    agentOptions: { provider: 'offline-order-test', model: 'fixed-response' } });
  t.after(() => handle.dispose());
  const { agent } = handle;
  return { ctx, agent, installed, requests, run: line => ctx.commands.execute(agent, line, [], new AbortController().signal) };
}

test('真实 AgentLoop 发起单次及并行失败，完整结果先于 PUA 记录和候选', async t => {
  for (const count of [1, 2]) await t.test(String(count), async t => {
    const { agent, run, requests } = await setup(t, { count });
    await run('/pua 处理测试任务');
    await agent.whenIdle();
    assert.equal(requests.length, 2);
    requests.forEach(request => assertToolOrder(request.messages));
    const events = agent.session.snapshotEvents();
    const results = events.filter(event => event.type === 'tool/result');
    assert.equal(results.length, count);
    assert.ok(events.filter(event => event.type === 'user/message' && isRuntime(event.data)).every(event => event.seq > results.at(-1).seq));
    assert.doesNotMatch(JSON.stringify(requests[1].messages), /PUA_RUNTIME_V1/);
    assert.match((await run('/pua status')).result.text, new RegExp('终端失败观察：' + count));
    assert.equal(JSON.stringify(requests[1].messages).includes('PUA Candidate L1'), count === 2);
  });
});

test('工具组未完成时 off、取消和卸载不插入消息，安全边界后保留取消状态', { timeout: 10000 }, async t => {
  for (const mode of ['off', 'cancel', 'unload']) await t.test(mode, async t => {
    let release, arrived;
    const wait = new Promise(resolve => { release = resolve; });
    const ready = new Promise(resolve => { arrived = resolve; });
    const { ctx, agent, installed, run, requests } = await setup(t, { count: 2, execute: async ({ index }) => {
      if (index === 1) await wait;
      return { exitCode: 1 };
    } });
    t.after(() => release());
    ctx.on('session/event', (session, event) => { if (session === agent.session && event.type === 'tool/result') arrived(); });
    await run('/pua loop "测试取消" --max-iterations 1');
    await ready;
    try {
      if (mode === 'off') await run('/pua off');
      else if (mode === 'cancel') agent.cancel({ kind: 'user' });
      else await installed.dispose();
      const middle = agent.session.deriveMessages();
      const callIndex = middle.findIndex(message => message.content.some(block => block.type === 'tool-call'));
      assert.ok(middle.slice(callIndex + 1).every(message => message.source.kind === 'tool'));
    } finally { release(); await agent.whenIdle(); }
    requests.forEach(request => assertToolOrder(request.messages));
    assertToolOrder(agent.session.deriveMessages());
    const restored = Session.create('after-cancel', JSON.parse(JSON.stringify(agent.session.snapshotEvents())));
    const runtime = new PuaRuntime(ctx, new StateStore(), new SourceCatalog(), new AbortController().signal);
    assert.equal(runtime.read(restored).loop.status, 'cancelled');
    assert.ok(runtime.read(restored).failureCount >= 1);
  });
});

function brokenHistory({ replaced = false, complete = true, foreign = false } = {}) {
  const session = Session.create('old-order');
  session.append('turn/start', { turn: 1 });
  session.append('step/start', { turn: 1, step: 1 });
  const calls = [0, 1].map(index => ({ type: 'tool-call', id: 'old-' + index, name: 'bash', arguments: '{}' }));
  session.append('assistant/message', { turn: 1, step: 1, message: createAssistantMessage({ content: calls, source: { provider: 'offline-order-test', model: 'fixed-response' } }) }, { surfaceOp: 'append' });
  for (const [index, call] of calls.entries()) {
    const originalCall = session.append('tool/call', { turn: 1, step: 1, callId: call.id, name: call.name, arguments: call.arguments });
    const note = '新增终端失败观察；不是任务失败判定。';
    const record = session.append('user/message', textMessage('PUA_RUNTIME_V1 ' + JSON.stringify({ failureCount: index + 1, failures: ['old-' + index] }) + '\n' + note, foreign ? { kind: 'user' } : runtimeSource), { surfaceOp: 'append' });
    if (replaced) session.append('user/message', textMessage(note, runtimeSource), { surfaceOp: { op: 'replace', start: record.seq, end: record.seq }, sourceEventSeqs: [record.seq] });
    if (complete || index === 0) session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: call.id, content: [{ type: 'text', text: 'ModuleNotFoundError: retained evidence ' + index }], isError: true }), error: { name: 'ToolError', code: 'FAILED' }, meta: { original: true } }, { surfaceOp: 'append', sourceEventSeqs: [originalCall.seq] });
  }
  session.append('step/end', { turn: 1, step: 1 });
  session.append('turn/end', { turn: 1, reason: { kind: 'error', error: { code: 'BAD_REQUEST', message: '历史请求顺序不合法' } } });
  return JSON.parse(JSON.stringify(session.snapshotEvents()));
}

test('旧 RECORD 和替换说明自动兼容，完整结果身份不变，重载与分叉可回放', async t => {
  for (const replaced of [false, true]) for (const inherited of [false, true]) await t.test(`${replaced}/${inherited}`, async t => {
    const seed = brokenHistory({ replaced });
    const { agent, requests, installed, ctx } = await setup(t, { seed, inherited });
    agent.followup(textMessage('继续天气查询'));
    await agent.whenIdle();
    assert.equal(requests.length, 1);
    assertToolOrder(requests[0].messages);
    const expected = seed.filter(event => event.type === 'tool/result').map(event => event.data.message);
    assert.deepEqual(requests[0].messages.filter(message => message.source.kind === 'tool'), expected);
    assert.deepEqual(agent.session.snapshotEvents(0, seed.length), seed, '原始事件不得重写');
    await installed.dispose();
    const restored = Session.create('replay', JSON.parse(JSON.stringify(agent.session.snapshotEvents())));
    assertToolOrder(restored.deriveMessages());
    const runtime = new PuaRuntime(ctx, new StateStore(), new SourceCatalog(), new AbortController().signal);
    assert.equal(runtime.read(agent.session).failureCount, inherited ? 0 : 2);
    const previousLength = agent.session.seq;
    await ctx.plugin(plugin).await();
    agent.followup(textMessage('再次继续'));
    await agent.whenIdle();
    assertToolOrder(requests.at(-1).messages);
    assert.equal(agent.session.snapshotEvents(previousLength).filter(event => event.surfaceOp?.op === 'replace').length, 0, '兼容处理必须幂等');
  });
});

test('历史兼容不移除同名用户消息，也不伪造缺失的工具结果', async t => {
  for (const options of [{ foreign: true }, { complete: false }]) await t.test(JSON.stringify(options), async t => {
    const seed = brokenHistory(options);
    const { agent, requests } = await setup(t, { seed });
    agent.followup(textMessage('继续'));
    await agent.whenIdle();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].messages.filter(message => message.source.kind === 'tool').length, options.complete === false ? 1 : 2);
    if (options.foreign) assert.ok(requests[0].messages.some(message => message.source.kind === 'user' && JSON.stringify(message.content).includes('PUA_RUNTIME_V1')));
  });
});
