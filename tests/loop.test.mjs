import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { AgentRegistry } from '@deepseek-ai/dsh-agent';
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop';
import { CommandRuntime } from '@deepseek-ai/dsh-commands';
import { LlmAdapter, LlmRuntime, createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import * as plugin from '../lib/index.js';

test('真实 Agent 循环：首次唤醒带风味，关闭后的下轮请求移除风味', { timeout: 10000 }, async t => {
  const requests = [];
  class OfflineAdapter extends LlmAdapter {
    async *stream(options) {
      requests.push(options);
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: '离线测试回复' };
      yield { type: 'block-end', index: 0, block: { type: 'text', text: '离线测试回复' } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  new SessionStore(ctx);
  new AgentRegistry(ctx);
  new SessionProjectionRegistry(ctx);
  new LlmRuntime(ctx);
  new SystemPrompt(ctx, { includeHarnessIdentity: false });
  new ToolRuntime(ctx);
  new CommandRuntime(ctx);
  new AgentLoop(ctx, { agents: [] });
  ctx.llm.registerAdapter(['offline-pua-test'], new OfflineAdapter());
  const installed = ctx.plugin(plugin);
  await installed.await();
  const handle = await ctx.agents.create({ sessionId: 'pua-loop-test', agentOptions: { provider: 'offline-pua-test', model: 'fixed-response' } });
  t.after(() => handle.dispose());
  const { agent } = handle;
  const run = line => ctx.commands.execute(agent, line, [], new AbortController().signal);
  await run('/pua flavor huawei');
  assert.equal((await run('/pua 处理离线测试任务')).result.kind, 'success');
  await agent.whenIdle();
  assert.equal(requests.length, 1);
  assert.match(requests[0].system, /军令状/);
  assert.match(requests[0].system, /PUA-DIAGNOSIS/);
  await run('/pua review');
  await agent.whenIdle();
  assert.equal(requests.length, 2);
  const reviewRequest = JSON.stringify(requests[1]);
  assert.match(reviewRequest, /只读审查/);
  assert.match(reviewRequest, /未获取 Git 证据/);
  assert.match(requests[1].system, /每一句话都用当前味道的语气在说话/);
  await run('/pua done-check');
  await agent.whenIdle();
  assert.equal(requests.length, 3);
  for (const key of ['claim', 'evidence', 'missing', 'done_with_evidence']) assert.ok(JSON.stringify(requests[2]).includes(key));
  await run('/pua off');
  assert.equal(requests.length, 3);
  agent.followup(createUserMessage({ content: [{ type: 'text', text: '继续正常任务' }], source: { kind: 'user' } }));
  await agent.whenIdle();
  assert.equal(requests.length, 4);
  assert.match(requests[3].system, /已关闭/);
  assert.doesNotMatch(requests[3].system, /军令状/);
  await installed.dispose();
  assert.equal(ctx.commands.find(agent, 'pua'), undefined);
});
