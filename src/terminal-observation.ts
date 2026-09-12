import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools';

export const TERMINAL_REVIEW_PROMPT = 'PUA · 终端状态待核验：输出包含非零退出、超时或 shell 异常结束的文本标记，但文本也可能由命令自行打印。先结合实际错误、当前子目标和必要的独立检查判断，再选择修复方法；不要仅凭标记宣称失败次数、升级压力或声称验收通过。';

/** 持久终端仅返回文本时提供核验线索；绝不将可伪造的输出算成结构化失败。 */
export function terminalTextNeedsReview(result: Readonly<ToolExecutionResult>): boolean {
  if (result.isError || typeof result.value !== 'string') return false;
  const value = result.value.trim();
  const exit = /(?:^|\n)\[(?:exit code: |shell exited: code |Command finished with exit code )(-?\d+)\](?:\r?\nThe persistent (?:pwsh|bash) shell was reset;[^\n]*)?$/u.exec(value);
  return (exit !== null && Number(exit[1]) !== 0)
    || /^Your command timed out after \d+ seconds or experienced an OOM error\./u.test(value)
    || /(?:^|\n)\[shell killed by signal: [A-Z0-9]+\](?:\r?\nThe persistent (?:pwsh|bash) shell was reset;[^\n]*)?$/u.test(value);
}
