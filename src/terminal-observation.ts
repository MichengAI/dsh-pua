import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools';

import { serverCopy } from './server-copy.js';

/** 终端核验提醒；每次读取当前语言，语言切换后立即生效。 */
export function terminalReviewPrompt(): string { return serverCopy().prompt.terminalReview; }

/** 持久终端仅返回文本时提供核验线索；绝不将可伪造的输出算成结构化失败。 */
export function terminalTextNeedsReview(result: Readonly<ToolExecutionResult>): boolean {
  if (result.isError || typeof result.value !== 'string') return false;
  const value = result.value.trim();
  const exit = /(?:^|\n)\[(?:exit code: |shell exited: code |Command finished with exit code )(-?\d+)\](?:\r?\nThe persistent (?:pwsh|bash) shell was reset;[^\n]*)?$/u.exec(value);
  return (exit !== null && Number(exit[1]) !== 0)
    || /^Your command timed out after \d+ seconds or experienced an OOM error\./u.test(value)
    || /(?:^|\n)\[shell killed by signal: [A-Z0-9]+\](?:\r?\nThe persistent (?:pwsh|bash) shell was reset;[^\n]*)?$/u.test(value);
}
