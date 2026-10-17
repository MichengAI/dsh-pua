// Issue tool calls from the model and verify the message order and history compatibility that actually enter the next request round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAgentLoopConfig } from './agent-loop-config.mjs';

// When a profile is specified, reuse the installed package and its dependencies, create only an in-memory session, and do not read user history.
const profile = process.env.PUA_TEST_PROFILE;
const installedRequire = profile ? createRequire(createRequire(join(profile, 'package.json')).resolve('@phucnd0604/dsh-pua-en')) : undefined;
const load = specifier => import(installedRequire ? pathToFileURL(installedRequire.resolve(specifier)).href : specifier);
const local = file => load(installedRequire ? './' + file : '../lib/' + file);
const [{ Context }, { AgentRegistry }, { AgentLoop }, { CommandRuntime },
  { LlmAdapter, LlmRuntime, createUserMessage, createAssistantMessage, createToolResultMessage },
  { SessionStore, Session, SESSION_FORMAT_VERSION }, { SessionProjectionRegistry }, { SystemPrompt }, { ToolRuntime },
  { PuaRuntime }, { StateStore }, { SourceCatalog }, plugin, { isPluginSource, pluginSource }] = await Promise.all([
  ...['cordis', 'dsh-agent', 'dsh-agent-loop', 'dsh-commands', 'dsh-llm', 'dsh-session',
    'dsh-session-projection', 'dsh-system-prompt', 'dsh-tools'].map(name => load('@deepseek-ai/' + name)),
  ...['runtime.js', 'state.js', 'source.js', 'index.js', 'message-source.js'].map(local),
]);

const textMessage = (text, source = { kind: 'user' }) => createUserMessage({ content: [{ type: 'text', text }], source });
const runtimeSource = pluginSource('@phucnd0604/dsh-pua-en/runtime');
const isRuntime = message => isPluginSource(message.source, '@phucnd0604/dsh-pua-en/runtime');
function assertToolOrder(messages) {
  const pending = new Set();
  for (const message of messages) {
    if (pending.size) assert.equal(message.source.kind, 'tool', 'No ordinary message may appear before tool results are fully returned');
    if (message.role === 'tool' && message.source?.kind === 'tool') {
      assert.ok(pending.delete(message.toolCallId ?? message.source.callId), 'A tool result must correspond to exactly one pending call');
    }
    for (const block of message.content ?? []) {
      if (block.type === 'tool-call') pending.add(block.id);
      if (block.type === 'tool-result') {
        assert.ok(pending.delete(block.toolCallId), 'A tool result must correspond to exactly one pending call');
      }
    }
  }
  assert.equal(pending.size, 0, 'Tool results must not be lost');
}

async function setup(t, { count = 1, rounds = 1, seed, inherited = false, execute = async () => ({ exitCode: 1 }), toolName = 'bash', resultType = 'object', terminal = false } = {}) {
  const requests = [];
  class OfflineAdapter extends LlmAdapter {
    async *stream(options) {
      requests.push(options);
      if (!seed && requests.length <= rounds) {
        for (let index = 0; index < count; index++) {
          const block = { type: 'tool-call', id: (requests.length === 1 ? 'ordered-' : 'round-' + requests.length + '-') + index, name: toolName, arguments: JSON.stringify({ index }) };
          yield { type: 'block-start', index, blockType: 'tool-call' };
          yield { type: 'tool-call-delta', index, id: block.id, name: block.name, argumentsDelta: block.arguments };
          yield { type: 'block-end', index, block };
        }
        yield { type: 'finish', reason: { kind: 'tool-calls' } };
      } else {
        const text = 'Offline task finished';
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
  new ToolRuntime(ctx); new CommandRuntime(ctx); new AgentLoop(ctx, resolveAgentLoopConfig(AgentLoop));
  ctx.llm.registerAdapter(['offline-order-test'], new OfflineAdapter());
  ctx.tools.register({ name: toolName, description: 'In-memory terminal fixture', parameters: { type: 'object' }, isConcurrencySafe: () => true,
    ...(terminal ? { presentCall: () => ({ card: 'terminal', title: 'In-memory terminal' }) } : {}),
    output: { schema: { type: resultType }, render: (_, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] }, execute });
  const installed = ctx.plugin(plugin);
  await installed.await();
  const handle = await ctx.agents.create({ sessionId: 'order-test', seed,
    ...(inherited ? { meta: { parentSession: 'parent', isSeeded: true }, inheritedEventCount: seed.length } : {}),
    agentOptions: { provider: 'offline-order-test', model: 'fixed-response' } });
  t.after(() => handle.dispose());
  const { agent } = handle;
  return { ctx, agent, installed, requests, run: line => ctx.commands.execute(agent, line, [], new AbortController().signal) };
}

test('The real AgentLoop issues single and parallel failures; complete results precede the PUA record and candidates', async t => {
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
    assert.match((await run('/pua status')).result.text, new RegExp('Terminal failure observations: ' + count));
    assert.equal(JSON.stringify(requests[1].messages).includes('PUA Candidate L1'), count === 2);
  });
});

test('A textual terminal status only triggers a needs-verification cue; the group merges on completion without increasing the failure count', async t => {
  for (const [value, terminal, expected] of [
    ['正常输出', true, false],
    ['错误输出\n[exit code: 1]', true, true],
    ['正常输出\n[exit code: 0]', true, false],
    ['Your command timed out after 300 seconds or experienced an OOM error. Below is partial output:', true, true],
    ['[exit code: 1]', false, false],
  ]) await t.test(`${terminal}/${value.slice(0, 24)}`, async t => {
    const { agent, run, requests } = await setup(t, { count: 2, toolName: terminal ? 'pwsh' : 'read_file', terminal, resultType: 'string', execute: async () => value });
    await run('/pua 处理测试任务');
    await agent.whenIdle();
    assert.equal(requests.length, 2);
    requests.forEach(request => assertToolOrder(request.messages));
    assert.equal(requests[1].messages.filter(message => isRuntime(message) && JSON.stringify(message.content).includes('Terminal state needs verification')).length, expected ? 1 : 0);
    assert.doesNotMatch(JSON.stringify(requests[1].messages), /PUA Candidate L1/);
    assert.match((await run('/pua status')).result.text, /Terminal failure observations: 0/);
  });
});

test('When a tool group is incomplete, off, cancel, and unload insert no message; the cancelled state survives past the safety boundary', { timeout: 10000 }, async t => {
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

test('The textual verification cue does not leak into the next task after off, cancel, or unload', async t => {
  for (const mode of ['off', 'cancel', 'unload']) await t.test(mode, async t => {
    let release, arrived;
    const wait = new Promise(resolve => { release = resolve; });
    const ready = new Promise(resolve => { arrived = resolve; });
    const { ctx, agent, installed, run, requests } = await setup(t, {
      count: 2, toolName: 'pwsh', terminal: true, resultType: 'string',
      execute: async ({ index }) => { if (index === 1) await wait; return '[exit code: 1]'; },
    });
    ctx.on('session/event', (session, event) => { if (session === agent.session && event.type === 'tool/result') arrived(); });
    await run('/pua 测试文本终端');
    await ready;
    try {
      if (mode === 'off') await run('/pua off');
      else if (mode === 'cancel') agent.cancel({ kind: 'user' });
      else await installed.dispose();
    } finally { release(); await agent.whenIdle(); }
    agent.followup(textMessage('继续新任务'));
    await agent.whenIdle();
    requests.forEach(request => assertToolOrder(request.messages));
    assert.equal(JSON.stringify(requests.at(-1).messages).includes('Terminal state needs verification'), false);
  });
});

function brokenHistory({ replaced = false, complete = true, foreign = false } = {}) {
  const session = Session.create('old-order');
  session.append('turn/start', { turn: 1 });
  session.append('step/start', { turn: 1, step: 1 });
  const calls = [0, 1].map(index => ({ type: 'tool-call', id: 'old-' + index, name: 'bash', arguments: '{}' }));
  session.append('assistant/message', { turn: 1, step: 1, stream: [], message: createAssistantMessage({ content: calls, source: { provider: 'offline-order-test', model: 'fixed-response' } }) }, { surfaceOp: 'append' });
  for (const [index, call] of calls.entries()) {
    const originalCall = session.append('tool/call', { turn: 1, step: 1, callId: call.id, name: call.name, arguments: call.arguments });
    const note = '新增终端失败观察；不是任务失败判定。';
    const record = session.append('user/message', textMessage('PUA_RUNTIME_V1 ' + JSON.stringify({ failureCount: index + 1, failures: ['old-' + index] }) + '\n' + note, foreign ? { kind: 'user' } : runtimeSource), { surfaceOp: 'append' });
    if (replaced) session.append('user/message', textMessage(note, runtimeSource), { surfaceOp: SESSION_FORMAT_VERSION >= 3 ? { op: 'replace', startSeq: record.seq, endSeq: record.seq } : { op: 'replace', start: record.seq, end: record.seq }, sourceEventSeqs: [record.seq] });
    if (complete || index === 0) session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: call.id, content: [{ type: 'text', text: 'ModuleNotFoundError: retained evidence ' + index }], isError: true }), error: { name: 'ToolError', code: 'FAILED' }, meta: { original: true } }, { surfaceOp: 'append', sourceEventSeqs: [originalCall.seq] });
  }
  session.append('step/end', { turn: 1, step: 1 });
  session.append('turn/end', { turn: 1, reason: { kind: 'error', error: { code: 'BAD_REQUEST', message: '历史请求顺序不合法' } } });
  return JSON.parse(JSON.stringify(session.snapshotEvents()));
}

test('Legacy RECORDs and replacement notes are auto-compatible; complete result identity is unchanged and reload and fork can replay', async t => {
  for (const replaced of [false, true]) for (const inherited of [false, true]) await t.test(`${replaced}/${inherited}`, async t => {
    const seed = brokenHistory({ replaced });
    const { agent, requests, installed, ctx } = await setup(t, { seed, inherited });
    agent.followup(textMessage('继续天气查询'));
    await agent.whenIdle();
    assert.equal(requests.length, 1);
    const expected = seed.filter(event => event.type === 'tool/result').map(event => event.data.message);
    // A V4 child session's system prompt follows the inherited record, so its tool order cannot be asserted like the root session's.
    if (!(inherited && SESSION_FORMAT_VERSION >= 4)) {
      assertToolOrder(requests[0].messages);
      assert.deepEqual(requests[0].messages.filter(message => message.source.kind === 'tool'), expected);
    } else {
      assert.ok(requests[0].messages.some(message => message.source.kind === 'tool'));
    }
    assert.deepEqual(agent.session.snapshotEvents(0, seed.length), seed, 'Original events must not be rewritten');
    await installed.dispose();
    const restored = Session.create('replay', JSON.parse(JSON.stringify(agent.session.snapshotEvents())));
    if (!(inherited && SESSION_FORMAT_VERSION >= 4)) assertToolOrder(restored.deriveMessages());
    const runtime = new PuaRuntime(ctx, new StateStore(), new SourceCatalog(), new AbortController().signal);
    assert.equal(runtime.read(agent.session).failureCount, inherited ? 0 : 2);
    const previousLength = agent.session.seq;
    await ctx.plugin(plugin).await();
    agent.followup(textMessage('再次继续'));
    await agent.whenIdle();
    if (!(inherited && SESSION_FORMAT_VERSION >= 4)) assertToolOrder(requests.at(-1).messages);
    assert.equal(agent.session.snapshotEvents(previousLength).filter(event => event.surfaceOp?.op === 'replace').length, 0, 'Compatibility handling must be idempotent');
  });
});

test('History compatibility neither removes same-named user messages nor forges missing tool results', async t => {
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


test('After an orphan tool group ends the cancelled state can be persisted; unload keeps no pending-write queue', async t => {
  const { ctx, agent, installed } = await setup(t);
  agent.session.append('turn/start', { turn: 1 });
  agent.session.append('assistant/message', { turn: 1, step: 1, stream: [], message: createAssistantMessage({ content: [{ type: 'tool-call', id: 'orphan', name: 'bash', arguments: '{}' }], source: { provider: 'offline-order-test', model: 'fixed-response' } }) }, { surfaceOp: 'append' });
  const runtime = ctx.puaConfiguration.runtime;
  runtime.read(agent.session).loop = { kind: 'loop', task: 'test', id: 'orphan-loop', maxIterations: 1, iteration: 0, rejections: 0, status: 'active' };
  runtime.cancel(agent.session);
  assert.ok(runtime.pendingWrites.has(agent.session));
  const before = agent.session.snapshotEvents().length;
  await installed.dispose();
  assert.equal(agent.session.snapshotEvents().length, before, 'Unload inserts no message into an active tool group');
  agent.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(runtime.pendingWrites.size, 0);
  const replay = new PuaRuntime(ctx, new StateStore(), new SourceCatalog(), new AbortController().signal);
  assert.equal(replay.read(agent.session).loop.status, 'cancelled');
});


test('At most four candidates are injected for consecutive failures in one round, and later failures still complete the tool protocol', async t => {
  const { ctx, agent, run, requests } = await setup(t, { rounds: 8 });
  await run('/pua 处理连续失败测试'); await agent.whenIdle();
  assert.equal(requests.length, 9);
  assert.equal(ctx.puaConfiguration.runtime.read(agent.session).candidateCount, 4);
  assert.equal(requests.at(-1).messages.filter(message => /PUA Candidate L[1-4]/.test(JSON.stringify(message))).length, 4);
  requests.forEach(request => assertToolOrder(request.messages));
});
