import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// 每个版本使用独立依赖树和构建产物副本，不修改开发依赖或用户 profile。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const supported = pkg.peerDependencies['@deepseek-ai/dsh-session'].split(' || ');
const versions = process.argv.slice(2).length ? process.argv.slice(2) : supported;
if (versions.some(version => !supported.includes(version))) throw new Error('只能验证声明的支持版本。');
const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli)) throw new Error('请通过 npm run test:compat 执行。');
if (!existsSync(join(root, 'lib/index.js'))) throw new Error('请先 npm run build。');
const tmpBase = join(root, '.test-tmp');
mkdirSync(tmpBase, { recursive: true });
const run = (cwd, args) => new Promise((resolveResult, reject) => {
  const env = { ...process.env };
  delete env.PUA_TEST_PROFILE;
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true });
  let output = '';
  child.stdout.on('data', data => { output += data.toString('utf8'); });
  child.stderr.on('data', data => { output += data.toString('utf8'); });
  child.on('error', reject);
  child.on('close', code => resolveResult({ code, output }));
});

const results = await Promise.allSettled(versions.map(async version => {
  const dir = mkdtempSync(join(tmpBase, `compat-${version}-`));
  console.log(`${version}：创建隔离依赖树`);
  try {
    const manifest = structuredClone(pkg);
    delete manifest.scripts;
    // 同一 0.1.5 预发布系列的 ^rc.1 会选到 rc.2，必须固定整条官方依赖闭包。
    if (version.startsWith('0.1.5-')) {
      manifest.overrides = Object.fromEntries(Object.keys(lock.packages)
        .filter(path => path.startsWith('node_modules/@deepseek-ai/dsh-'))
        .map(path => [path.slice('node_modules/'.length), version]));
    }
    for (const key of Object.keys(manifest.devDependencies)) {
      if (!key.startsWith('@deepseek-ai/dsh-')) continue;
      if (!version.startsWith('0.1.5-') && ['dsh-tool-pwsh-persistent', 'dsh-tool-bash-persistent', 'dsh-terminal', 'dsh-session-format-v2-to-v3'].some(name => key.endsWith('/' + name))) delete manifest.devDependencies[key];
      else manifest.devDependencies[key] = version;
    }
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    for (const name of ['lib', 'assets', 'tests']) cpSync(join(root, name), join(dir, name), { recursive: true });
    const install = await run(dir, [npmCli, 'install', '--ignore-scripts', '--registry=https://registry.npmjs.org/', '--no-audit', '--no-fund']);
    if (install.code !== 0) throw new Error(`依赖安装失败\n${install.output.slice(-4000)}`);
    for (const name of ['dsh-agent', 'dsh-session', 'dsh-tools']) {
      const installed = JSON.parse(readFileSync(join(dir, 'node_modules', '@deepseek-ai', name, 'package.json'), 'utf8'));
      if (installed.version !== version) throw new Error(`${name} 意外解析为 ${installed.version}`);
    }
    const files = readdirSync(join(dir, 'tests')).filter(name => name.endsWith('.test.mjs') && (version.startsWith('0.1.5-') || !['persistent-terminal.test.mjs', 'session-migration.test.mjs'].includes(name))).map(name => join('tests', name));
    if (!files.length) throw new Error('兼容测试目录为空，拒绝报告成功。');
    const tested = await run(dir, ['--test', '--test-timeout=20000', ...files]);
    if (tested.code !== 0) throw new Error(`回归失败\n${tested.output.slice(-6000)}`);
    if (!/(?:tests|pass) [1-9]\d*/u.test(tested.output)) throw new Error('未发现实际执行的测试计数。');
    console.log(`${version}：${tested.output.split(/\r?\n/u).filter(line => /(?:tests|pass|fail|skipped) \d+/u.test(line)).join('；')}`);
    return version;
  } finally {
    if (!resolve(dir).startsWith(resolve(tmpBase) + sep)) throw new Error('拒绝清理越界目录。');
    rmSync(dir, { recursive: true, force: true });
  }
}));
results.forEach((result, index) => {
  if (result.status === 'rejected') { console.error(`${versions[index]}：${result.reason.message}`); process.exitCode = 1; }
});
