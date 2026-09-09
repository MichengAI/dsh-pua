import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// 只检查调用者指定目录的已安装包，不自行安装、读取用户会话或调用模型。
const prefix = process.argv[2];
if (!prefix) throw new Error('请提供已安装包的隔离目录。');
const modules = resolve(prefix, 'node_modules');
const requireInstalled = createRequire(pathToFileURL(join(modules, '@michengai/dsh-pua/package.json')));
const load = name => import(pathToFileURL(requireInstalled.resolve('@deepseek-ai/' + name)).href);
const [{ Context }, { CommandRuntime }, { Session, SESSION_FORMAT_VERSION }, { SystemPrompt, renderPrompt }, plugin] = await Promise.all([
  load('cordis'), load('dsh-commands'), load('dsh-session'), load('dsh-system-prompt'),
  import(pathToFileURL(join(modules, '@michengai/dsh-pua/lib/index.js')).href),
]);
const pkg = JSON.parse(readFileSync(join(modules, '@michengai/dsh-pua/package.json'), 'utf8'));
const ctx = new Context();
const gitCwd = process.argv[3];
if (gitCwd) {
  const { LocalSubprocessRuntime } = await load('dsh-subprocess-local');
  new LocalSubprocessRuntime(ctx);
}
new CommandRuntime(ctx);
new SystemPrompt(ctx, { includeHarnessIdentity: false });
const installed = ctx.plugin(plugin);
try {
  await installed.await();
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
  assert.match(text, /军令状/);
  assert.match(text, /PUA-DIAGNOSIS/);
  await run('/pua again');
  assert.match(messages.at(-1).content[0].text, /路径 B/);
  await run('/pua done-check');
  assert.match(messages.at(-1).content[0].text, /done_with_evidence/);
  assert.equal((await run('/pua review')).result.kind, 'success');
  assert.match(messages.at(-1).content[0].text, gitCwd ? /Git 索引观察/ : /未获取 Git 证据/);
  await run('/pua off');
  assert.match(renderPrompt(await ctx.systemPrompt.assemble({ agent })), /已关闭/);
  await installed.dispose();
  assert.equal(ctx.commands.find(agent, 'pua'), undefined);
  console.log(`安装包验证通过：${pkg.name}@${pkg.version}，依赖解析、误输入、原版模板、审查${gitCwd ? '及真实 Git 预检' : '降级'}、开关和卸载正常。`);
} finally {
  await ctx.fiber.dispose();
}
