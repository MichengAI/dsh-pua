import test from 'node:test';
import assert from 'node:assert/strict';
import { Session, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session';
import { createAssistantMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm';
import { sessionFormatV2ToV3 } from '@deepseek-ai/dsh-session-format-v2-to-v3';
import { Context } from '@deepseek-ai/cordis';
import { PuaRuntime } from '../lib/runtime.js';
import { StateStore } from '../lib/state.js';
import { SourceCatalog } from '../lib/source.js';
import { repairPuaToolOrder } from '../lib/tool-order.js';

const legacyRuntime = text => createUserMessage({
  content: [{ type: 'text', text }],
  source: { kind: 'plugin', plugin: '@michengai/dsh-pua/runtime' },
});

test('官方 V2→V3 迁移后的 PUA 插入历史可修复，运行状态和工具证据可重载', { skip: SESSION_FORMAT_VERSION >= 4 ? 'V4 宿主不直接装载 V3 迁移产物；旧日志由宿主迁移器打开' : false }, async t => {
  const header = { version: 2, id: 'migration-fixture', createdAt: 1, isSeeded: false, delegationDepth: 0 };
  const call = { type: 'tool-call', id: 'v2-call', name: 'bash', arguments: '{}' };
  const currentResult = createToolResultMessage({ callId: call.id, content: [{ type: 'text', text: '保留工具错误证据' }], isError: true });
  // V2 工具结果仍是 user 包装。0.1.7 的构造器直接产出 tool 角色，不能原样送进 V2 迁移。
  const originalResult = currentResult.role === 'tool' ? {
    role: 'user', id: currentResult.id, source: { kind: 'tool', callId: call.id },
    content: [{ type: 'tool-result', toolCallId: call.id, content: currentResult.content, isError: true }],
  } : currentResult;
  const rows = [
    ['turn/start', { turn: 1 }],
    ['step/start', { turn: 1, step: 1 }],
    ['assistant/message', { turn: 1, step: 1, stream: [], message: createAssistantMessage({ content: [call], source: { provider: 'fixture', model: 'fixed' } }) }, 'append'],
    ['tool/call', { turn: 1, step: 1, callId: call.id, name: call.name, arguments: call.arguments }],
    ['user/message', legacyRuntime('PUA_RUNTIME_V1 {"failureCount":2,"failures":["v2-hash"]}\n失败观察'), 'append'],
    ['user/message', legacyRuntime('失败观察'), { op: 'replace', start: 4, end: 4 }, [4]],
    ['tool/result', { turn: 1, step: 1, message: originalResult, error: { name: 'ToolError', code: 'FAILED' }, meta: { retained: true } }, 'append', [3]],
    ['step/end', { turn: 1, step: 1 }],
    ['turn/end', { turn: 1, reason: { kind: 'error', error: { code: 'BAD_REQUEST', message: '工具顺序错误' } } }],
  ];
  const events = rows.map(([type, data, surfaceOp, sourceEventSeqs], seq) => ({ type, seq, time: seq + 1, data,
    ...(surfaceOp === undefined ? {} : { surfaceOp }), ...(sourceEventSeqs ? { sourceEventSeqs } : {}) }));
  const before = JSON.stringify(events);
  const migrated = [];
  const sink = { emitEvent: event => migrated.push(event), emitRun: run => migrated.push(...run.expand()) };
  const upgraded = sessionFormatV2ToV3.migrateHeader(header);
  const stage = sessionFormatV2ToV3.createStage({ sourceHeader: header, targetHeader: upgraded, sourceInheritedEventCount: 0, sourceKind: 'transformed' });
  events.forEach(event => stage.transformEvent(event, sink));
  const inherited = stage.finish(sink);
  const session = Session.create(header.id, migrated, upgraded, inherited);
  const originalPrefix = JSON.stringify(session.snapshotEvents());
  const originalLength = session.snapshotEvents().length;
  repairPuaToolOrder(session, '@michengai/dsh-pua/runtime');
  const messages = session.deriveMessages();
  const callIndex = messages.findIndex(message => message.content.some(block => block.type === 'tool-call'));
  assert.equal(messages[callIndex + 1].source.kind, 'tool');
  assert.deepEqual(messages[callIndex + 1], originalResult);
  assert.equal(JSON.stringify(events), before);
  assert.equal(JSON.stringify(session.snapshotEvents(0, originalLength)), originalPrefix);
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const runtime = new PuaRuntime(ctx, new StateStore(), new SourceCatalog(), new AbortController().signal);
  assert.equal(runtime.read(session).failureCount, 2);
  const restored = Session.create(header.id, JSON.parse(JSON.stringify(session.snapshotEvents())), upgraded, inherited);
  assert.deepEqual(restored.deriveMessages(), messages);
});
