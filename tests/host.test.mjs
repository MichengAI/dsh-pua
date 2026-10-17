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

test('Real command and prompt services: off by default, explicit activation, flavor selection, off, unload', async t => {
  const { ctx, installed } = await setup(t);
  const a = agent();
  assert.equal(await prompt(ctx, a), '');
  assert.equal((await run(ctx, a, '/pua flavor huawei')).result.kind, 'success');
  assert.equal(a.messages.length, 0);
  assert.equal((await run(ctx, a, '/pua 修复登录')).result.kind, 'success');
  assert.equal(a.messages[0].mode, 'followup');
  const sourceName = source => source.kind === 'plugin' ? source.plugin : source.kind.slice('plugin:'.length);
  assert.equal(sourceName(a.messages[0].source), '@phucnd0604/dsh-pua-en');
  assert.match(a.messages[0].content[0].text, /修复登录/);
  const active = await prompt(ctx, a);
  assert.match(active, /Huawei/);
  assert.match(active, /PUA-DIAGNOSIS/);
  assert.doesNotMatch(active, /## 2\. 🟡 ByteDance Flavor/);
  assert.equal((await run(ctx, a, '/pua off')).result.kind, 'success');
  assert.match(await prompt(ctx, a), /PUA mode is off/);
  assert.doesNotMatch(await prompt(ctx, a), /written-pledge mode/);
  assert.equal(a.messages.length, 1);
  await installed.dispose();
  assert.equal(ctx.commands.find(a, 'pua'), undefined);
  assert.equal(await prompt(ctx, a), '');
});

test('Isolation and restore: different sessions in the same directory do not cross state; rebuilding the same session restores; a fork inherits nothing', async t => {
  const { ctx } = await setup(t);
  const a = agent('a');
  await run(ctx, a, '/pua on');
  await run(ctx, a, '/pua flavor huawei');
  assert.equal(await prompt(ctx, agent('b')), '');
  const history = JSON.parse(JSON.stringify(a.session.snapshotEvents()));
  const restored = agent('a', history);
  assert.match(await prompt(ctx, restored), /written-pledge mode/);
  const fork = agent('fork', history, { parentSession: 'a' }, history.length);
  assert.match(await prompt(ctx, fork), /PUA mode is off/);
  assert.doesNotMatch(await prompt(ctx, fork), /written-pledge mode/);
  await run(ctx, restored, '/pua off');
  assert.match(await prompt(ctx, a), /written-pledge mode/);
});

test('The empty command and quality entries deliver the current step; switch, status, and help start no model call', async t => {
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
  assert.match(a.messages[2].content[0].text, /completion quality check/);
  assert.match(a.messages[3].content[0].text, /evidence/);
});

test('Cancellation, argument errors, and delivery failures do not activate; failure state is not restored after a restart', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  for (const command of ['/pua flavor ../../secret', '/pua off all']) {
    assert.equal((await run(ctx, a, command)).result.kind, 'error');
  }
  const aborted = AbortSignal.abort();
  await assert.rejects(() => run(ctx, a, '/pua on', aborted));
  a.steer = () => { throw new Error('enqueue failed'); };
  assert.equal((await run(ctx, a, '/pua')).result.kind, 'error');
  assert.equal(await prompt(ctx, a), '');
  assert.equal(await prompt(ctx, agent('a', a.session.snapshotEvents())), '');
});

test('Concurrent commands keep their sequential state and do not restore an unfinished command', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  await Promise.all([run(ctx, a, '/pua on'), run(ctx, a, '/pua flavor huawei'), run(ctx, a, '/pua off')]);
  assert.match(await prompt(ctx, a), /PUA mode is off/);
  const restored = agent('a', a.session.snapshotEvents());
  assert.match(await prompt(ctx, restored), /PUA mode is off/);
  restored.session.append('command/run', { commandId: 'incomplete', name: 'pua', args: ' on', source: { kind: 'user' } });
  assert.match(await prompt(ctx, restored), /PUA mode is off/);
});

test('Mistyped input neither wakes nor activates; a repeated-prefix flavor list is not submitted as a task', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  for (const line of ['/pua in', '/pua onn', '/pua loop']) assert.equal((await run(ctx, a, line)).result.kind, 'error');
  assert.equal((await run(ctx, a, '/pua pua flavor')).result.kind, 'success');
  assert.equal(a.messages.length, 0);
  assert.equal(await prompt(ctx, a), '');
});

test('After upgrade, legacy mistyped input is recovered from the historical success result, and existing switches are not rewritten with new syntax', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  a.session.append('command/run', { commandId: 'legacy', name: 'pua', args: ' pua flavor', source: { kind: 'user' } });
  a.session.append('command/done', { commandId: 'legacy', kind: 'success', text: 'PUA · 已提交任务请求，风味：阿里。请查看 Agent 后续结果。' });
  assert.match(await prompt(ctx, a), /PUA-DIAGNOSIS/);
  await run(ctx, a, '/pua off');
  assert.match(await prompt(ctx, a), /PUA mode is off/);
});

test('The original fast entry point output protocol enters the actual delivered content', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  await run(ctx, a, '/pua again');
  assert.match(a.messages[0].content[0].text, /Path A/);
  assert.match(a.messages[0].content[0].text, /Path B/);
  await run(ctx, a, '/pua done-check');
  for (const key of ['claim', 'evidence', 'missing', 'done_with_evidence']) assert.ok(a.messages[1].content[0].text.includes(key));
  await run(ctx, a, '/pua evidence');
  assert.match(a.messages[2].content[0].text, /needs_check/);
});

test('The review entry sends a read-only task and clearly marks evidence as unavailable when the Git service is missing', async t => {
  const { ctx } = await setup(t);
  const a = agent();
  assert.equal((await run(ctx, a, '/pua review')).result.kind, 'success');
  assert.equal(a.messages.length, 1);
  assert.equal(a.messages[0].mode, 'followup');
  assert.match(a.messages[0].content[0].text, /read-only review/);
  assert.match(a.messages[0].content[0].text, /No Git evidence collected/);
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
    // An empty root directory stops the precheck, making the single async wait point precisely controllable.
    return { done, collected: { stdout: { readFrom: () => ({ text: '', lossy: false }) } } };
  } });
  return { started, release: () => release() };
}

test('No activation while the review precheck waits; a late off still takes effect after review completion and rebuild', async t => {
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
  assert.match(await prompt(ctx, a), /PUA mode is off/);
  assert.match(await prompt(ctx, agent('restored', a.session.snapshotEvents())), /PUA mode is off/);
});

test('/pua is still registered when the host denies root events during activation', async t => {
  const ctx = new Context();
  new CommandRuntime(ctx);
  new SystemPrompt(ctx, { includeHarnessIdentity: false });
  const originalSymbol = Symbol.for('cordis.original');
  let events = ctx.root.events;
  const seen = new WeakSet();
  while (events && typeof events === 'object' && !seen.has(events)) {
    seen.add(events);
    const next = events[originalSymbol];
    if (!next || next === events) break;
    events = next;
  }
  const original = events.on;
  let denied = 0;
  Object.defineProperty(events, 'on', {
    configurable: true,
    writable: true,
    value: function (...args) {
      if (this?.ctx === ctx.root && (args[0] === 'session/event' || args[0] === 'agent/disposed')) {
        denied += 1;
        throw new Error('dsh-tui: root.events.on is unavailable from a plugin activation');
      }
      return original.apply(this, args);
    },
  });
  t.after(() => { delete events.on; return ctx.fiber.dispose(); });
  const installed = ctx.plugin(plugin);
  await installed.await();
  assert.ok(denied >= 1);
  const a = agent();
  assert.equal(ctx.commands.find(a, 'pua')?.name, 'pua');
  assert.equal((await run(ctx, a, '/pua help')).result.kind, 'success');
});

test('Other root-event errors still block activation', async t => {
  const ctx = new Context();
  new CommandRuntime(ctx);
  new SystemPrompt(ctx, { includeHarnessIdentity: false });
  const originalSymbol = Symbol.for('cordis.original');
  let events = ctx.root.events;
  const seen = new WeakSet();
  while (events && typeof events === 'object' && !seen.has(events)) {
    seen.add(events);
    const next = events[originalSymbol];
    if (!next || next === events) break;
    events = next;
  }
  const original = events.on;
  Object.defineProperty(events, 'on', {
    configurable: true,
    writable: true,
    value: function (...args) {
      if (this?.ctx === ctx.root && args[0] === 'session/event') throw new Error('root listener failed');
      return original.apply(this, args);
    },
  });
  t.after(() => { delete events.on; return ctx.fiber.dispose(); });
  await assert.rejects(ctx.plugin(plugin).await(), /root listener failed/);
});

test('Cancel or unload during the precheck delivers no task and does not restore the enabled state', async t => {
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
