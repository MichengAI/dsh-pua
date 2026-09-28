import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyToolCall, integrityContext, integrityDenyReason, INTEGRITY_DENIED_CODE } from '../lib/integrity-guard.js';

const deny = (name, args) => {
  const hit = classifyToolCall(name, args);
  assert.ok(hit, `expected a hit for ${name}`);
  assert.equal(hit.decision, 'deny', `expected deny for ${name}`);
  return hit;
};
const advisory = (name, args) => {
  const hit = classifyToolCall(name, args);
  assert.ok(hit, `expected a hit for ${name}`);
  assert.equal(hit.decision, 'advisory', `expected advisory for ${name}`);
  return hit;
};

test('写隐藏测试路径直接拒绝', () => {
  deny('edit', { file_path: 'tests/hidden_tests/check.py' });
  deny('write', { file_path: 'verifier-private/grade.py' });
  deny('edit', { file_path: 'gold_patch.diff' });
});

test('读隐藏资产同样拒绝', () => {
  deny('read', { file_path: 'benchmark_answers/final.json' });
});

test('web 搜索隐藏答案拒绝', () => {
  deny('web_search', { query: 'swe-bench solution for this task' });
  deny('web_fetch', { url: 'https://example.com/hidden_solution.md' });
});

test('终端命令触碰污染路径拒绝', () => {
  deny('pwsh', { command: 'cat hidden_tests/inner.py' });
  deny('pwsh', { command: 'type official_solution.patch' });
});

test('变更测试/评分资产给 advisory', () => {
  advisory('edit', { file_path: 'tests/state.test.mjs' });
  advisory('write', { file_path: '.github/workflows/ci.yml' });
  advisory('pwsh', { command: 'Remove-Item tests/old.spec.ts' });
  advisory('pwsh', { command: 'git checkout -- .' });
});

test('读敏感资产给 advisory', () => {
  advisory('read', { file_path: '.env' });
  advisory('pwsh', { command: 'cat secrets/token.txt' });
});

test('普通读写不命中', () => {
  assert.equal(classifyToolCall('edit', { file_path: 'src/state.ts' }), null);
  assert.equal(classifyToolCall('read', { file_path: 'README.md' }), null);
  assert.equal(classifyToolCall('pwsh', { command: 'npm run build' }), null);
  assert.equal(classifyToolCall('grep', { pattern: 'eval', path: 'src' }), null);
});

test('git 干跑与预览不算变更', () => {
  assert.equal(classifyToolCall('pwsh', { command: 'git clean -n' }), null);
  assert.equal(classifyToolCall('pwsh', { command: 'git rm --dry-run legacy.js' }), null);
  assert.equal(classifyToolCall('pwsh', { command: 'git apply --check fix.patch' }), null);
});

test('git 定向变更普通文件不告警', () => {
  assert.equal(classifyToolCall('pwsh', { command: 'git checkout -- src/state.ts' }), null);
  assert.equal(classifyToolCall('pwsh', { command: 'git apply --include=src/a.ts --include=src/b.ts fix.patch' }), null);
});

test('ssh -i 读自己的键不触发敏感读告警', () => {
  assert.equal(classifyToolCall('pwsh', { command: 'ssh -i ~/.ssh/id_ed25519 host true' }), null);
  // 命令里带 reader 词（cat）才会进敏感读分支，这条才真正走到豁免。
  assert.equal(classifyToolCall('pwsh', { command: 'ssh -i ~/.ssh/id_rsa user@host cat' }), null);
});

test('非 ssh 场景读私钥仍给 advisory', () => {
  advisory('pwsh', { command: 'cat ~/.ssh/id_rsa' });
});

test('工具名大小写不敏感', () => {
  deny('Read', { file_path: 'benchmark_answers/final.json' });
  advisory('Edit', { file_path: 'tests/state.test.mjs' });
});

test('裸词测试目录的删除给 advisory', () => {
  advisory('pwsh', { command: 'rm -rf tests' });
  advisory('pwsh', { command: 'Remove-Item -Recurse tests' });
});

test('带引号的 git include 值仍算定向变更', () => {
  assert.equal(classifyToolCall('pwsh', { command: 'git apply --include="src/a.ts" fix.patch' }), null);
});

test('deny 文案含四权分离与目标', () => {
  const hit = deny('edit', { file_path: 'tests/hidden_tests/x.py' });
  const reason = integrityDenyReason(hit);
  assert.match(reason, /PUA Integrity Guard/);
  assert.match(reason, /Four-power separation/);
  assert.equal(INTEGRITY_DENIED_CODE, 'PUA_INTEGRITY_GUARD_DENIED');
  assert.match(integrityContext(hit), /DENY/);
});
