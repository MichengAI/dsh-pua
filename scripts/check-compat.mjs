import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Each version gets its own dependency tree and build artifact copy; dev dependencies and the user profile are never modified.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const supported = pkg.peerDependencies['@deepseek-ai/dsh-session'].split(' || ');
const HOST_PINS = {
  '0.2.0-rc.1': { cordis: '4.0.4', schemastery: '3.18.4' },
  '0.2.0-rc.2': { cordis: '4.0.4', schemastery: '3.18.4' },
  '0.2.1-rc.1': { cordis: '4.0.5', schemastery: '3.18.5' },
  '0.2.1-rc.2': { cordis: '4.0.5', schemastery: '3.18.5' },
};
const versions = process.argv.slice(2).length ? process.argv.slice(2) : supported;
if (versions.some(version => !supported.includes(version))) throw new Error('Only the declared supported versions can be verified.');
const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli)) throw new Error('Run this through npm run test:compat.');
if (!existsSync(join(root, 'lib/index.js'))) throw new Error('Run npm run build first.');
const tmpBase = join(tmpdir(), 'dsh-pua-compat');
mkdirSync(tmpBase, { recursive: true });
const run = (cwd, args) => new Promise((resolveResult, reject) => {
  const env = { ...process.env };
  delete env.PUA_TEST_PROFILE;
  delete env.NODE_PATH;
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true });
  let output = '';
  child.stdout.on('data', data => { output += data.toString('utf8'); });
  child.stderr.on('data', data => { output += data.toString('utf8'); });
  child.on('error', reject);
  child.on('close', code => resolveResult({ code, output }));
});

const results = await Promise.allSettled(versions.map(async version => {
  const dir = mkdtempSync(join(tmpBase, `compat-${version}-`));
  console.log(`${version}: creating isolated dependency tree`);
  try {
    const manifest = structuredClone(pkg);
    delete manifest.scripts;
    const pin = HOST_PINS[version];
    if (!pin) throw new Error('No Cordis pin is defined for ' + version + '.');
    manifest.overrides = {
      ...Object.fromEntries(Object.keys(manifest.devDependencies)
        .filter(name => name.startsWith('@deepseek-ai/dsh-'))
        .map(name => [name, version])),
      '@deepseek-ai/cordis': pin.cordis,
      '@deepseek-ai/schemastery': pin.schemastery,
    };
    manifest.devDependencies['@deepseek-ai/schemastery'] = pin.schemastery;
    manifest.devDependencies['@deepseek-ai/cordis'] = pin.cordis;
    for (const key of Object.keys(manifest.devDependencies)) {
      if (!key.startsWith('@deepseek-ai/dsh-')) continue;
      manifest.devDependencies[key] = version;
    }
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    for (const name of ['lib', 'assets', 'tests']) cpSync(join(root, name), join(dir, name), { recursive: true });
    const install = await run(dir, [npmCli, 'install', '--ignore-scripts', '--registry=https://registry.npmjs.org/', '--no-audit', '--no-fund']);
    if (install.code !== 0) throw new Error(`dependency install failed\n${install.output.slice(-4000)}`);
    for (const name of ['dsh-agent', 'dsh-session', 'dsh-tools']) {
      const installed = JSON.parse(readFileSync(join(dir, 'node_modules', '@deepseek-ai', name, 'package.json'), 'utf8'));
      if (installed.version !== version) throw new Error(`${name} unexpectedly resolved to ${installed.version}`);
    }
    const isolatedRequire = createRequire(join(dir, 'package.json'));
    for (const name of Object.keys(manifest.devDependencies).filter(name => name.startsWith('@deepseek-ai/') || ['react', 'react-dom', 'zod'].includes(name))) {
      const resolved = isolatedRequire.resolve(name);
      if (!resolve(resolved).startsWith(resolve(dir) + sep)) throw new Error(name + ' resolved outside the isolated directory: ' + resolved);
    }
    const files = readdirSync(join(dir, 'tests')).filter(name => name.endsWith('.test.mjs')).map(name => join('tests', name));
    if (!files.length) throw new Error('The compatibility test directory is empty; refusing to report success.');
    // These files spawn real PowerShell several times; parallel cloud version regression needs startup headroom.
    const tested = await run(dir, ['--test', '--test-timeout=60000', ...files]);
    if (tested.code !== 0) {
      writeFileSync(join(tmpBase, 'last-failure.txt'), tested.output);
      throw new Error(`regression failed\n${tested.output.slice(-6000)}`);
    }
    if (!/(?:tests|pass) [1-9]\d*/u.test(tested.output)) throw new Error('No actual test count found in the output.');
    console.log(`${version}: ${tested.output.split(/\r?\n/u).filter(line => /(?:tests|pass|fail|skipped) \d+/u.test(line)).join('; ')}`);
    return version;
  } finally {
    if (!resolve(dir).startsWith(resolve(tmpBase) + sep)) throw new Error('Refusing to clean a directory outside the temp base.');
    rmSync(dir, { recursive: true, force: true });
  }
}));
results.forEach((result, index) => {
  if (result.status === 'rejected') { console.error(`${versions[index]}: ${result.reason.message}`); process.exitCode = 1; }
});
