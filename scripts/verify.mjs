import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import assert from 'node:assert/strict';
import { loadPrompts, loadCommandPrompts, QUALITY_COMMANDS, MAX_PROMPT_BYTES, MODES, renderOriginalPrompt } from '../lib/content.js';
import { SourceCatalog } from '../lib/source.js';
import { FLAVORS } from '../lib/flavors.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
assert.equal(pkg.version, lock.version, '锁文件版本不一致');
assert.equal(pkg.name, lock.name, '锁文件包名不一致');
assert.match(read('cordis.patch.yml'), /name: '@michengai\/dsh-pua'/);
const manifest = JSON.parse(read('assets/pua/upstream.json'));
assert.match(manifest.revision, /^[0-9a-f]{40}$/);
const expected = ['flavors.md', ...FLAVORS.map(f => `methodology-${f.id}.md`), ...QUALITY_COMMANDS.map(name => `command-${name}.md`)].sort();
assert.deepEqual(manifest.files.filter(file => !file.file.startsWith('upstream/')).map(file => file.file).sort(), expected, '旧素材清单与风味不一致');
assert.equal(manifest.files.filter(file => file.file.startsWith('upstream/')).length, 85, '完整原版目录缺失');
for (const entry of manifest.files) {
  const bytes = readFileSync(join(root, 'assets/pua', entry.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `素材指纹变化：${entry.file}`);
  assert.equal(createHash('sha256').update(bytes.toString('utf8').replaceAll('\r\n', '\n')).digest('hex'), entry.gitBlobSha256, `素材与固定提交内容不同：${entry.file}`);
}
const prompts = loadPrompts();
assert.equal(loadCommandPrompts().size, 3);
assert.equal(prompts.size, 15);
const sizes = [...prompts.values()].map(text => Buffer.byteLength(text, 'utf8'));
const catalog = new SourceCatalog();
for (const mode of MODES) for (const flavor of ['auto', ...FLAVORS.map(item => item.id)]) sizes.push(Buffer.byteLength(renderOriginalPrompt(catalog, flavor, mode), 'utf8'));
assert.ok(Math.max(...sizes) <= MAX_PROMPT_BYTES);

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith('.md') ? [path] : [];
  });
}

const docs = join(root, 'docs');
const markdown = [join(root, 'README.md'), ...markdownFiles(docs)];
let links = 0;
for (const file of markdown) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^(?:[a-z]+:|#)/i.test(href)) continue;
    const target = resolve(dirname(file), decodeURIComponent(href.split('#')[0]));
    const rel = relative(root, target);
    assert.ok(!isAbsolute(rel) && !rel.startsWith('..'), `文档链接越界：${href}`);
    assert.ok(existsSync(target), `断链：${relative(root, file)} → ${href}`);
    links++;
  }
}
const iterations = [];
for (const dir of ['01-当前工作', '07-迭代归档']) {
  const base = join(docs, dir);
  if (!existsSync(base)) continue;
  for (const file of markdownFiles(base).filter(file => file.endsWith('00-迭代总览.md'))) {
    const name = dirname(file).split(/[\\/]/).pop();
    const id = /^I\d{3}-/.exec(name)?.[0];
    assert.ok(id, `迭代名称无效：${name}`);
    assert.ok(!iterations.includes(id), `迭代编号重复：${id}`);
    iterations.push(id);
    const content = readFileSync(file, 'utf8');
    if (dir === '01-当前工作') assert.match(content, /状态：(计划中|进行中|阻塞)/);
    else assert.match(content, /状态：(已完成|已取消)/);
  }
}
assert.ok(iterations.length > 0, '缺少迭代总览');
assert.equal(readdirSync(docs).filter(name => name.endsWith('.md')).length, 0, 'docs 根目录有散落 Markdown');
console.log(`校验通过：${manifest.files.length} 份原版素材，${prompts.size} 种风味，提示词 ${Math.min(...sizes)}–${Math.max(...sizes)} 字节，${links} 个文档链接。`);
