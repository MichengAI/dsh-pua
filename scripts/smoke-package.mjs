import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Checks only the installed package in the directory the caller names; it never installs anything,
// reads user sessions, or calls a model.
const prefix = process.argv[2];
if (!prefix) throw new Error('Provide the isolated directory of the installed package.');
const modules = resolve(prefix, 'node_modules');
const requireInstalled = createRequire(pathToFileURL(join(modules, '@phucnd0604/dsh-pua-en/package.json')));
const load = name => import(pathToFileURL(requireInstalled.resolve('@deepseek-ai/' + name)).href);
const [{ Context, Service }, { CommandRuntime }, { Session, SESSION_FORMAT_VERSION }, { SystemPrompt, renderPrompt }, { ToolRuntime }, plugin] = await Promise.all([
  load('cordis'), load('dsh-commands'), load('dsh-session'), load('dsh-system-prompt'),
  load('dsh-tools'),
  import(pathToFileURL(join(modules, '@phucnd0604/dsh-pua-en/lib/index.js')).href),
]);
const pkg = JSON.parse(readFileSync(join(modules, '@phucnd0604/dsh-pua-en/package.json'), 'utf8'));
const ctx = new Context();
const gitCwd = process.argv[3];
if (gitCwd) {
  const { LocalSubprocessRuntime } = await load('dsh-subprocess-local');
  new LocalSubprocessRuntime(ctx);
}
new CommandRuntime(ctx);
new SystemPrompt(ctx, { includeHarnessIdentity: false });
new ToolRuntime(ctx);
const configBox = { current: undefined };
const write = Symbol.for('cosmokit.volatile.write');
class MemorySettings extends Service {
  constructor(context) { super(context, 'settings'); }
  configure() { return () => {}; }
  value() {
    const config = configBox.current;
    return config && typeof config.get === 'function' ? config.get() : config;
  }
  get(ns) { return ns === 'phucnd0604-pua-en' ? this.value() : undefined; }
  describe() { return [{ ns: 'phucnd0604-pua-en', revision: 0, value: this.value() }]; }
  async update(_ns, patch) {
    const config = configBox.current;
    if (config && typeof config.get === 'function' && write in config) config[write]({ ...config.get(), ...patch });
    else if (config) Object.assign(config, patch);
  }
}
new MemorySettings(ctx);
const installed = ctx.plugin(plugin);
try {
  await installed.await();
  configBox.current = installed.config;
  const messages = [];
  const agent = {
    id: 'package-smoke',
    session: Session.create('package-smoke', [], { id: 'package-smoke', version: SESSION_FORMAT_VERSION, createdAt: 1, isSeeded: false, ...(gitCwd ? { cwd: gitCwd } : {}) }),
    followup: message => messages.push(message), steer: message => messages.push(message),
  };
  const run = line => ctx.commands.execute(agent, line, [], new AbortController().signal);
  assert.equal((await run('/pua in')).result.kind, 'error');
  await run('/pua pua flavor');
  assert.equal(messages.length, 0);
  for (const line of ['/pua flavor huawei', '/pua on']) {
    assert.equal((await ctx.commands.execute(agent, line, [], new AbortController().signal)).result.kind, 'success');
  }
  const text = renderPrompt(await ctx.systemPrompt.assemble({ agent }));
  assert.match(text, /Written-Pledge/);
  assert.match(text, /PUA-DIAGNOSIS/);
  assert.match(text, /carry the PUA flavor of the current flavor/);
  assert.match(text, /# PUA Display Protocol/);
  assert.equal(ctx.settings.get('phucnd0604-pua-en').flavor, 'auto');
  const reference = await ctx.tools.execute({ name: 'pua_reference', arguments: { path: 'skills/pua/SKILL.md' }, agent, callId: 'smoke-reference', signal: new AbortController().signal });
  assert.equal(reference.isError, false);
  assert.equal(reference.value, readFileSync(join(modules, '@phucnd0604/dsh-pua-en/assets/pua/upstream/skills/pua/SKILL.md'), 'utf8'));
  await run('/pua p9 review the team handoff');
  assert.match(renderPrompt(await ctx.systemPrompt.assemble({ agent })), /Current DSH mode: p9/);
  await run('/pua flavor auto');
  assert.match(renderPrompt(await ctx.systemPrompt.assemble({ agent })), /Flavor not locked/);
  await run('/pua again');
  assert.match(messages.at(-1).content[0].text, /Path B/);
  await run('/pua done-check');
  assert.match(messages.at(-1).content[0].text, /done_with_evidence/);
  assert.equal((await run('/pua review')).result.kind, 'success');
  assert.match(messages.at(-1).content[0].text, gitCwd ? /Git index observation/ : /No Git evidence collected/);
  await run('/pua off');
  assert.match(renderPrompt(await ctx.systemPrompt.assemble({ agent })), /PUA mode is off/);
  await installed.dispose();
  assert.equal(ctx.commands.find(agent, 'pua'), undefined);
  assert.equal(ctx.tools.get('pua_reference'), undefined);
  console.log(`Installed-package check passed: ${pkg.name}@${pkg.version}; full core, P9, auto, settings, reference tool, review${gitCwd ? ' with real Git pre-check' : ' fallback'}, switch, and uninstall all behave.`);
} finally {
  await ctx.fiber.dispose();
}
