import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import assert from 'node:assert/strict';
import { loadPrompts, loadCommandPrompts, MAX_PROMPT_BYTES, MODES, renderOriginalPrompt } from '../lib/content.js';
import { SourceCatalog } from '../lib/source.js';
import { FLAVORS } from '../lib/flavors.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
assert.equal(pkg.version, lock.version, 'lock file version mismatch');
assert.equal(pkg.name, lock.name, 'lock file package name mismatch');
assert.deepEqual(lock.packages[''].peerDependencies, pkg.peerDependencies, 'lock file peer range out of sync');
assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies, 'lock file devDependencies out of sync');
const hostRange = pkg.peerDependencies['@deepseek-ai/dsh-session'];
for (const [name, range] of Object.entries(pkg.peerDependencies)) {
  if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(range, hostRange, `${name} host support range mismatch`);
}
const hostVersion = pkg.devDependencies['@deepseek-ai/dsh-session'];
assert.ok(hostRange.split(' || ').includes(hostVersion), 'dev host version is outside the supported range');
for (const [name, version] of Object.entries(pkg.devDependencies)) {
  if (!name.startsWith('@deepseek-ai/dsh-')) continue;
  assert.equal(version, hostVersion, `${name} does not pin the same host version`);
  assert.equal(lock.packages[`node_modules/${name}`].version, version, `${name} resolved lock-file version mismatch`);
}
assert.match(read('cordis.patch.yml'), /name: '@phucnd0604\/dsh-pua-en'/);
const manifest = JSON.parse(read('assets/pua/upstream.json'));
assert.match(manifest.revision, /^[0-9a-f]{40}$/);
// The plugin upstream (MichengAI/dsh-pua) baseline the English tree was translated from.
// Offline check: shape only, never the value (docs/adr/0003 decision 3).
assert.equal(manifest.pluginUpstream.repository, 'https://github.com/MichengAI/dsh-pua');
assert.match(manifest.pluginUpstream.revision, /^[0-9a-f]{40}$/);
assert.match(manifest.pluginUpstream.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.files.filter(file => file.file.startsWith('upstream/')).length, 85, 'full original file list is missing');
// assets/pua holds only the vendored upstream tree: the legacy top-level copies were deleted in
// ticket #1 and must never come back (docs/adr/0003 decision 6, docs/agents/upstream-sync.md section 6).
assert.deepEqual(manifest.files.filter(file => !file.file.startsWith('upstream/')).map(file => file.file), [], 'unexpected non-vendored asset entries');
// Two-layer manifest (schemaVersion 2): translate-once fork.
// sourceSha256/gitBlobSha256 pin the original Chinese bytes of the pinned upstream revision (for the vendoring diff).
// contentSha256 pins the current runtime-served bytes; it changes as files are translated.
// gitBlobSha256 is still asserted while a file matches its source (not yet translated).
for (const entry of manifest.files) {
  const bytes = readFileSync(join(root, 'assets/pua', entry.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.contentSha256, `content fingerprint mismatch: ${entry.file}`);
  if (entry.contentSha256 === entry.sourceSha256) {
    const normalized = createHash('sha256').update(bytes.toString('utf8').replaceAll('\r\n', '\n')).digest('hex');
    assert.equal(normalized, entry.gitBlobSha256, `asset differs from pinned commit: ${entry.file}`);
  }
}
// Zero-CJK policy (docs/adr/0002): everything under assets/pua is model-facing and must be English.
// Exempt: the provenance manifest keeps the romanized upstream author name, and the vendored
// Japanese skill (pua-ja) ships as-is.
const CJK_PATTERN = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
const CJK_EXEMPT = new Set(['assets/pua/upstream.json', 'assets/pua/upstream/skills/pua-ja/SKILL.md']);
const assetFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  // Every text type the vendored tree ships is scanned; a new extension has to be added here,
  // otherwise the zero-CJK gate silently skips it (docs/adr/0002 decision 1).
  return entry.isDirectory() ? assetFiles(path) : /\.(?:md|sh|txt|json|py)$/.test(entry.name) ? [path] : [];
});
const cjkOffenders = assetFiles(join(root, 'assets/pua'))
  .map(path => relative(root, path).replaceAll('\\', '/'))
  .filter(rel => !CJK_EXEMPT.has(rel) && CJK_PATTERN.test(readFileSync(join(root, rel), 'utf8')));
assert.deepEqual(cjkOffenders, [], `assets/pua must contain no CJK characters:\n${cjkOffenders.join('\n')}`);
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
const markdown = [join(root, 'README.md'), ...(existsSync(docs) ? markdownFiles(docs) : [])];
let links = 0;
for (const file of markdown) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^(?:[a-z]+:|#)/i.test(href)) continue;
    const target = resolve(dirname(file), decodeURIComponent(href.split('#')[0]));
    const rel = relative(root, target);
    assert.ok(!isAbsolute(rel) && !rel.startsWith('..'), `documentation link escapes the repo: ${href}`);
    assert.ok(existsSync(target), `broken link: ${relative(root, file)} -> ${href}`);
    links++;
  }
}
// docs/ is maintained locally only; public checkouts need not contain it, but it is still validated when present.
if (existsSync(docs)) {
  assert.equal(readdirSync(docs).filter(name => name.endsWith('.md')).length, 0, 'docs/ root contains stray Markdown files');
}
console.log(`Validation passed: ${manifest.files.length} original assets, zero-CJK assets, ${prompts.size} flavors, prompts ${Math.min(...sizes)}-${Math.max(...sizes)} bytes, ${links} documentation links.`);
