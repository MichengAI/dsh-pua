import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import { serverCopy } from './server-copy.js';

// 避免继承进程的 Git 环境把只读检查重定向到其他仓库。
const REPOSITORY_ENV: NodeJS.ProcessEnv = Object.fromEntries([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_IMPLICIT_WORK_TREE', 'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_REPLACE_REF_BASE', 'GIT_PREFIX',
  'GIT_SHALLOW_FILE', 'GIT_COMMON_DIR', 'GIT_NAMESPACE', 'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
].map(name => [name, undefined]));

/** 只读审查规则；每次读取当前语言，语言切换后立即生效。 */
export function reviewRules(): string { return serverCopy().review.rules; }

function summarize(paths: string[]) {
  return { count: paths.length, sample: paths.slice(0, 20).map(path => path.length > 240 ? path.slice(0, 240) + '…' : path), sampleComplete: paths.length <= 20 && paths.every(path => path.length <= 240) };
}

/** 从宿主执行环境采集有界、只读 Git 索引证据；失败返回缺口，外部取消向调用者抛出。 */
export async function collectGitEvidence(subprocess: Pick<SubprocessRuntime, 'spawn'> | undefined, cwd: string | undefined, signal: AbortSignal, timeoutMs = 10_000): Promise<string> {
  signal.throwIfAborted();
  if (!subprocess || !cwd) return serverCopy().review.noSubprocess;
  const timeout = new AbortController();
  const combined = AbortSignal.any([signal, timeout.signal]);
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const startedAt = new Date().toISOString();
  try {
    const git = async (args: string[]): Promise<string> => {
      combined.throwIfAborted();
      const handle = subprocess.spawn({
        argv: ['git', '-c', 'core.fsmonitor=false', ...args], cwd, signal: combined, graceMs: 1_000,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 * 1024 }, stderr: { maxBytes: 8192 } },
        env: { ...REPOSITORY_ENV, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' },
      });
      const result = await handle.done;
      combined.throwIfAborted();
      const output = handle.collected.stdout?.readFrom(0);
      const error = handle.collected.stderr?.readFrom(0);
      if (!output || output.lossy || error?.lossy) throw new Error(serverCopy().review.outputTruncated);
      if (result.exitCode !== 0 || result.signal) throw new Error(serverCopy().review.readFailed(String(result.exitCode ?? serverCopy().review.unknownCode)));
      return output.text;
    };
    const root = (await git(['rev-parse', '--show-toplevel'])).trim();
    if (!root) throw new Error(serverCopy().review.noRoot);
    const list = (text: string): string[] => {
      if (text && !text.endsWith('\0')) throw new Error(serverCopy().review.incompleteIndex);
      return text ? text.slice(0, -1).split('\0') : [];
    };
    const tracked = list(await git(['ls-files', '--full-name', '--cached', '--deduplicate', '-z', '--', ':/']));
    const ignoredTracked = list(await git(['ls-files', '--full-name', '--cached', '--deduplicate', '--ignored', '--exclude-standard', '-z', '--', ':/']));
    // ls-files 从子目录执行默认只列子树；显式根路径规格让计数覆盖已确认的仓库。
    return serverCopy().review.header + JSON.stringify({
      startedAt, finishedAt: new Date().toISOString(), cwd, root,
      scope: serverCopy().review.scope,
      commands: ['git -c core.fsmonitor=false rev-parse --show-toplevel', 'git -c core.fsmonitor=false ls-files --full-name --cached --deduplicate -z -- :/', 'git -c core.fsmonitor=false ls-files --full-name --cached --deduplicate --ignored --exclude-standard -z -- :/'],
      tracked: summarize(tracked), ignoredTracked: summarize(ignoredTracked),
      commonDirectoryTrackedCounts: Object.fromEntries(['artifacts', 'docs', 'test-results', '.codegraph'].map(dir => [dir, tracked.filter(path => path === dir || path.startsWith(dir + '/')).length])),
    });
  } catch (error) {
    signal.throwIfAborted();
    return serverCopy().review.noEvidence(timeout.signal.aborted ? serverCopy().review.timeout : error instanceof Error ? error.message : serverCopy().review.failed);
  } finally {
    clearTimeout(timer);
  }
}
