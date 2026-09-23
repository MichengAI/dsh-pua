import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const sourceTree = existsSync(new URL('../.github/workflows/ci.yml', import.meta.url));
const pkg = sourceTree ? JSON.parse(read('package.json')) : null;
const supported = ['0.1.2-rc.1', '0.1.5-rc.1', '0.1.5-rc.2', '0.1.7-rc.1'];

test('兼容列表只保留 RC，开发依赖钉到最新官方 RC', { skip: sourceTree ? false : '隔离兼容目录会改写开发依赖，只在源码树检查' }, () => {
  const range = pkg.peerDependencies['@deepseek-ai/dsh-session'];
  assert.deepEqual(range.split(' || '), supported);
  for (const [name, value] of Object.entries(pkg.peerDependencies)) {
    if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(value, range, name);
  }
  for (const [name, version] of Object.entries(pkg.devDependencies)) {
    if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(version, '0.1.7-rc.1', name);
  }
  assert.equal(pkg.devDependencies['@deepseek-ai/cordis'], '4.0.4');
  assert.equal(pkg.devDependencies['@deepseek-ai/schemastery'], '3.18.4');
  assert.ok(pkg.peerDependencies['@deepseek-ai/schemastery'].split(' || ').includes('3.18.4'));
  assert.equal(range.includes('alpha'), false);
});

test('CI 与说明中的兼容列表和 peer 一致', { skip: sourceTree ? false : '隔离兼容目录不复制 CI 和说明' }, () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /version: \['0\.1\.2-rc\.1', '0\.1\.5-rc\.1', '0\.1\.5-rc\.2', '0\.1\.7-rc\.1'\]/);
  assert.equal(ci.includes('alpha'), false);
  for (const file of ['README.md', 'README.zh-CN.md']) {
    const text = read(file);
    for (const version of supported) assert.equal(text.includes(version), true, file);
    assert.equal(text.includes('alpha'), false, file);
  }
});
