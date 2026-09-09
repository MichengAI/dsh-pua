import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Context } from '@deepseek-ai/cordis';
import { LocalSubprocessRuntime } from '@deepseek-ai/dsh-subprocess-local';
import { collectGitEvidence } from '../lib/review.js';

test('真实 Git：忽略但未跟踪的目录不算提交；强制入索引后可识别，子目录取全仓证据', async t => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-pua-review-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = args => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
  git(['init', '--quiet']);
  writeFileSync(join(root, '.gitignore'), 'artifacts/\ndocs/\ntest-results/\n.codegraph/\n', 'utf8');
  for (const dir of ['artifacts', 'docs', 'test-results', '.codegraph', 'src']) {
    mkdirSync(join(root, dir));
    writeFileSync(join(root, dir, '中文.txt'), 'fixture', 'utf8');
  }
  git(['add', '.gitignore', 'src']);
  const ctx = new Context();
  const subprocess = new LocalSubprocessRuntime(ctx);
  t.after(() => ctx.fiber.dispose());
  const collect = async () => {
    const text = await collectGitEvidence(subprocess, join(root, 'src'), new AbortController().signal);
    assert.match(text, /^Git 索引观察/);
    return JSON.parse(text.slice(text.indexOf('\n') + 1));
  };
  const before = await collect();
  assert.equal(before.tracked.count, 2);
  assert.equal(before.ignoredTracked.count, 0);
  assert.deepEqual(before.commonDirectoryTrackedCounts, { artifacts: 0, docs: 0, 'test-results': 0, '.codegraph': 0 });
  git(['add', '-f', 'artifacts']);
  const after = await collect();
  assert.equal(after.ignoredTracked.count, 1);
  assert.deepEqual(after.ignoredTracked.sample, ['artifacts/中文.txt']);
  assert.equal(after.commonDirectoryTrackedCounts.artifacts, 1);
  assert.equal(after.commonDirectoryTrackedCounts.docs, 0);
  assert.equal(git(['status', '--porcelain']).split('\n').filter(Boolean).length, 3);
  const nonRepo = mkdtempSync(join(tmpdir(), 'dsh-pua-nongit-'));
  t.after(() => rmSync(nonRepo, { recursive: true, force: true }));
  assert.match(await collectGitEvidence(subprocess, nonRepo, new AbortController().signal), /^未获取 Git 证据/);
});

test('Git 输出截断、执行失败和超时均为缺口，不生成虚假零计数；取消抛出', async () => {
  const stub = (exitCode, lossy) => ({ spawn: () => ({
    done: Promise.resolve({ exitCode, signal: null }),
    collected: { stdout: { readFrom: () => ({ text: '', lossy }) } },
  }) });
  const signal = new AbortController().signal;
  assert.match(await collectGitEvidence(stub(0, true), 'repo', signal), /未获取 Git 证据.*截断/);
  assert.match(await collectGitEvidence(stub(128, false), 'repo', signal), /未获取 Git 证据.*退出码 128/);
  const stalled = { spawn: spec => ({
    done: new Promise(resolve => spec.signal.addEventListener('abort', () => resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true })),
    collected: {},
  }) };
  assert.match(await collectGitEvidence(stalled, 'repo', signal, 10), /未获取 Git 证据.*超时/);
  await assert.rejects(() => collectGitEvidence(stub(0, false), 'repo', AbortSignal.abort()), { name: 'AbortError' });
});
