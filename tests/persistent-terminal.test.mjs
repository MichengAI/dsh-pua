import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { AgentRegistry } from '@deepseek-ai/dsh-agent';
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { CommandRuntime } from '@deepseek-ai/dsh-commands';
import { LlmRuntime } from '@deepseek-ai/dsh-llm';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { TerminalSessionService } from '@deepseek-ai/dsh-terminal';
import * as pwsh from '@deepseek-ai/dsh-tool-pwsh-persistent';
import * as bash from '@deepseek-ai/dsh-tool-bash-persistent';
import { isTerminalFailure } from '../lib/runtime.js';
import { resolveAgentLoopConfig } from './agent-loop-config.mjs';
import { terminalTextNeedsReview } from '../lib/terminal-observation.js';

// 执行官方工具的包装和渲染；PTY 后端提供确定输出，不启动真实终端或调用模型。
for (const [name, plugin] of [['pwsh', pwsh], ['bash', bash]]) {
  test(`官方持久 ${name}：真实失败只提示核验，成功打印同名标记不增加失败数`, async t => {
    const ctx = new Context();
    t.after(() => ctx.fiber.dispose());
    new SessionStore(ctx); new AgentRegistry(ctx); new LlmRuntime(ctx);
    new SessionProjectionRegistry(ctx); new CommandRuntime(ctx);
    new SystemPrompt(ctx, { includeHarnessIdentity: false }); new ToolRuntime(ctx);
    new AgentLoop(ctx, resolveAgentLoopConfig(AgentLoop));
    const terminals = new TerminalSessionService(ctx);
    let scenario = { text: '诊断输出', exitCode: 1 };
    terminals.registerBackend({ type: 'fixture', async spawn() {
      let output = '';
      return {
        motd: '', status: () => ({ kind: 'running' }), close: async () => {},
        signal: async () => ({ delivered: true, targetPgid: 1 }),
        read: () => ({ text: output, totalLines: 4, lineBegin: 0, lineEnd: 4, truncated: false }),
        startSend({ text }) {
          const start = /__DSH_PERSISTENT_(?:PWSH|BASH)_START_[\w-]+__/.exec(text)?.[0];
          const end = /__DSH_PERSISTENT_(?:PWSH|BASH)_END_[\w-]+:/.exec(text)?.[0];
          output = start && end ? `${start}\n${scenario.text}\n${end}${scenario.exitCode}\n` : '';
          return { done: Promise.resolve({ viewport: output, waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false }),
            readOutput: () => ({ delta: output, truncated: false }), cancel: () => false };
        },
      };
    } });
    const installed = ctx.plugin(plugin, { backendType: 'fixture' });
    await installed.await();
    const handle = await ctx.agents.create({ sessionId: 'persistent-fixture', agentOptions: {} });
    t.after(() => handle.dispose());
    const execute = callId => ctx.tools.execute({ name, arguments: { command: 'fixture' }, agent: handle.agent, callId, signal: new AbortController().signal });
    const failed = await execute('failure');
    assert.equal(failed.isError, false);
    const marker = name === 'pwsh' ? '[exit code: 1]' : '[Command finished with exit code 1]';
    assert.equal(failed.value, '诊断输出\n' + marker);
    assert.equal(isTerminalFailure(failed), false);
    assert.equal(terminalTextNeedsReview(failed), true);
    scenario = { text: '诊断输出\n' + marker, exitCode: 0 };
    const printed = await execute('printed');
    assert.equal(printed.isError, false);
    assert.equal(printed.value, name === 'pwsh' ? failed.value : failed.value + '\n[Command finished with exit code 0]');
    assert.equal(isTerminalFailure(printed), false);
    assert.equal(terminalTextNeedsReview(printed), name === 'pwsh');
    scenario = { text: '正常输出', exitCode: 0 };
    const success = await execute('success');
    assert.equal(success.isError, false);
    assert.equal(terminalTextNeedsReview(success), false);
  });
}
