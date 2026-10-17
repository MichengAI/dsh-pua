import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPendingToolCalls } from '../lib/tool-order.js';
import { parseArgs } from '../lib/args.js';
import { terminalTextNeedsReview } from '../lib/terminal-observation.js';
import { verifyLoop } from '../lib/runtime.js';
import { Context } from '@deepseek-ai/cordis';
import { LocalSubprocessRuntime } from '@deepseek-ai/dsh-subprocess-local';

test('Orphaned calls do not block after a turn ends or a new turn starts; inherited and replaced nodes do not count', () => {
  const events = [];
  const session = { seq: 0, inheritedEventCount: 0, surface: { nodes: [] }, snapshotEvents: offset => events.slice(offset) };
  const append = event => { event.seq = events.length; events.push(event); session.seq++; if (event.surfaceOp) session.surface.nodes.push(event.seq); };
  const call = id => append({ type: 'assistant/message', surfaceOp: 'append', data: { message: { content: [{ type: 'tool-call', id }] } } });
  call('one'); call('two');
  append({ type: 'tool/result', surfaceOp: 'append', data: { message: { source: { callId: 'one' } } } });
  assert.equal(hasPendingToolCalls(session), true);
  append({ type: 'turn/end' });
  assert.equal(hasPendingToolCalls(session), false);
  call('three'); assert.equal(hasPendingToolCalls(session), true);
  session.surface.nodes = []; assert.equal(hasPendingToolCalls(session), false);
  call('four'); append({ type: 'turn/start' }); assert.equal(hasPendingToolCalls(session), false);
  assert.equal(hasPendingToolCalls({ ...session, inheritedEventCount: session.seq }), false);
});

test('Structured Loop accepts the declared cap and JSON escapes, and still rejects an over-limit field', () => {
  const input = { task: '中'.repeat(4096), verify: '\\"'.repeat(4096), maxIterations: 0, verificationTimeout: 120 };
  assert.equal(parseArgs('loop-json ' + JSON.stringify(input)).verify, input.verify);
  assert.throws(() => parseArgs('loop-json ' + JSON.stringify({ ...input, verify: 'x'.repeat(8193) })));
  assert.throws(() => parseArgs('loop-json {'), /The configuration JSON is invalid/);
  assert.throws(() => parseArgs('config {'), /The configuration JSON is invalid/);
  assert.equal(parseArgs('loop "" x').task, 'x');
  assert.throws(() => parseArgs('loop x --verify ""'), /cannot be empty/);
});

test('The timeout notice allows leading blank lines', () => {
  assert.equal(terminalTextNeedsReview({ isError: false, value: '\nYour command timed out after 10 seconds or experienced an OOM error.' }), true);
});

test('Oracle preserves the native process\'s real non-zero exit code', { skip: process.platform !== 'win32' }, async t => {
  const ctx = new Context(); t.after(() => ctx.fiber.dispose());
  const result = await verifyLoop(new LocalSubprocessRuntime(ctx), 'cmd /c exit 5', process.cwd(), new AbortController().signal);
  assert.equal(result.ok, false);
  assert.equal(JSON.parse(result.detail).exitCode, 5);
});
