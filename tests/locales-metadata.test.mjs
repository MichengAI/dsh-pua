import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

const OFFICIAL_LANGUAGES = ['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt'];

test('官方 8 门内置语言元数据字典完整性与 detail 路径有效性', () => {
  for (const lang of OFFICIAL_LANGUAGES) {
    const localePath = join(rootDir, 'locale', `${lang}.json`);
    assert.ok(existsSync(localePath), `缺少语言字典: locale/${lang}.json`);
    const content = JSON.parse(readFileSync(localePath, 'utf8'));
    assert.ok(content.meta, `locale/${lang}.json 缺少 meta 字段`);
    assert.equal(typeof content.meta.title, 'string', `locale/${lang}.json meta.title 必须是字符串`);
    assert.ok(content.meta.title.length > 0, `locale/${lang}.json meta.title 不能为空`);
    assert.equal(typeof content.meta.description, 'string', `locale/${lang}.json meta.description 必须是字符串`);
    assert.ok(content.meta.description.length > 0, `locale/${lang}.json meta.description 不能为空`);
    assert.equal(typeof content.meta.detail, 'string', `locale/${lang}.json 必须声明 meta.detail`);
    assert.ok(existsSync(join(rootDir, content.meta.detail)), `locale/${lang}.json 引用的 detail 文件不存在: ${content.meta.detail}`);
    assert.ok(packageJson.files.includes(content.meta.detail), `package.json files 必须包含 detail 文件: ${content.meta.detail}`);

    // remote 字典检查
    const remotePath = join(rootDir, 'locale', 'remote', `${lang}.json`);
    assert.ok(existsSync(remotePath), `缺少远程语言字典: locale/remote/${lang}.json`);
    const remoteContent = JSON.parse(readFileSync(remotePath, 'utf8'));
    assert.ok(remoteContent.meta, `locale/remote/${lang}.json 缺少 meta 字段`);
    assert.equal(typeof remoteContent.meta.title, 'string');
    assert.equal(typeof remoteContent.meta.description, 'string');
  }
});

test('package.json 插件规范元数据与清单版本一致性', () => {
  assert.equal(packageJson.dsh?.manifestVersion, 1);
  assert.equal(packageJson.author?.name, 'MichengAI');
  assert.equal(packageJson.author?.url, 'https://github.com/MichengAI');
  assert.ok(Array.isArray(packageJson.keywords) && packageJson.keywords.includes('pua'));
  assert.equal(packageJson.icon, './assets/icon.svg');
  assert.equal(packageJson.exports?.['./icon'], './assets/icon.svg');
  assert.ok(existsSync(join(rootDir, 'assets/icon.svg')));
});

test('/pua help 命令帮助文本全量 8 门语言完备性', async () => {
  const { HELP_TEXTS, HELP } = await import('../lib/command.js');
  assert.ok(HELP && HELP.length > 50);
  for (const lang of OFFICIAL_LANGUAGES) {
    const text = HELP_TEXTS[lang];
    assert.ok(typeof text === 'string' && text.length > 50, `${lang} 缺少帮助文案`);
    assert.ok(text.includes('/pua'), `${lang} 帮助文案未包含基础命令说明`);
  }
});

test('handleCommand 命令回复层多语言接线真实驱动验证', async () => {
  const { handleCommand } = await import('../lib/command.js');
  const { StateStore } = await import('../lib/state.js');
  const { SourceCatalog } = await import('../lib/source.js');
  const { CONFIG_DEFAULTS } = await import('../lib/configuration.js');
  const { Session, SESSION_FORMAT_VERSION } = await import('@deepseek-ai/dsh-session');

  const makeAgent = (lang) => {
    const session = Session.create('s1', [], { id: 's1', version: SESSION_FORMAT_VERSION, createdAt: 1, cwd: '/test', isSeeded: false }, 0);
    return {
      agent: { id: 'a1', session },
      store: new StateStore(() => ({ ...CONFIG_DEFAULTS, language: lang, enabled: true })),
      catalog: new SourceCatalog(),
    };
  };

  // 1. 测试 en 语言会话
  const enEnv = makeAgent('en');
  const resEn = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c1', rawInput: '/pua help', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.ok(resEn.text.startsWith('PUA · Session · '), `英文会话前缀错误: ${resEn.text.slice(0, 30)}`);
  assert.ok(resEn.text.includes('Usage:'), '英文会话未输出英文正文');

  const resEnStatus = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c2', rawInput: '/pua status', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.ok(resEnStatus.text.startsWith('PUA · Session · '));
  assert.ok(resEnStatus.text.includes('Enabled; Mode:'));

  const resEnFlavors = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c3', rawInput: '/pua flavors', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.ok(resEnFlavors.text.startsWith('PUA · Session · '));
  assert.ok(resEnFlavors.text.includes('alibaba (Alibaba), bytedance (ByteDance)'));
  assert.ok(resEnFlavors.text.includes('Example: /pua flavor huawei'));

  // 2. 测试 ja 语言会话
  const jaEnv = makeAgent('ja');
  const resJa = await handleCommand(jaEnv.store, { agent: jaEnv.agent, commandId: 'c4', rawInput: '/pua help', signal: new AbortController().signal }, new Map(), undefined, { catalog: jaEnv.catalog });
  assert.ok(resJa.text.startsWith('PUA · セッション · '), `日文会话前缀错误: ${resJa.text.slice(0, 30)}`);
  assert.ok(resJa.text.includes('使い方：'), '日文会话未输出日文正文');

  const resJaFlavors = await handleCommand(jaEnv.store, { agent: jaEnv.agent, commandId: 'c5', rawInput: '/pua flavors', signal: new AbortController().signal }, new Map(), undefined, { catalog: jaEnv.catalog });
  assert.ok(resJaFlavors.text.startsWith('PUA · セッション · '));
  assert.ok(resJaFlavors.text.includes('alibaba (アリババ)'));
  assert.ok(resJaFlavors.text.includes('例：/pua flavor huawei'));

  // 3. 测试 zh 语言会话
  const zhEnv = makeAgent('zh-CN');
  const resZh = await handleCommand(zhEnv.store, { agent: zhEnv.agent, commandId: 'c6', rawInput: '/pua help', signal: new AbortController().signal }, new Map(), undefined, { catalog: zhEnv.catalog });
  assert.ok(resZh.text.startsWith('PUA · 会话 · '), `中文会话前缀错误: ${resZh.text.slice(0, 30)}`);
  assert.ok(resZh.text.includes('用法：'), '中文会话未输出中文正文');

  // 4. 测试 auto 且宿主 locale 为未支持的未知语言（如 it），安全回退至 en
  const autoEnv = makeAgent('auto');
  const mockCtx = { get(name) { return name === 'locale' ? { get() { return 'it-IT'; } } : undefined; } };
  const resUnknown = await handleCommand(autoEnv.store, { agent: autoEnv.agent, commandId: 'c7', rawInput: '/pua help', signal: new AbortController().signal }, new Map(), undefined, { catalog: autoEnv.catalog, ctx: mockCtx });
  assert.ok(resUnknown.text.startsWith('PUA · Session · '), `未知宿主语言回退 en 前缀错误: ${resUnknown.text.slice(0, 30)}`);
  assert.ok(resUnknown.text.includes('Usage:'), '未知宿主语言未回退至英文正文');
});

test('REMOTE_ERRORS 键与 remote.ts 抛出的错误及成功回执完全 1:1 对齐', async () => {
  const remoteTs = readFileSync(join(rootDir, 'src', 'remote.ts'), 'utf8');
  const clientTs = readFileSync(join(rootDir, 'src', 'client.ts'), 'utf8');

  // 提取 remote.ts 中所有的 throw new Error(...)
  const errorsInRemote = new Set();
  for (const m of remoteTs.matchAll(/throw new Error\(['"]([^'"]+)['"]\)/g)) {
    errorsInRemote.add(m[1]);
  }
  // 提取 remote.ts 中的两个 Loop 成功返回
  for (const m of remoteTs.matchAll(/text:\s*result\.result\.text\s*\?\?\s*['"]([^'"]+)['"]/g)) {
    errorsInRemote.add(m[1]);
  }

  // 提取 client.ts 中 REMOTE_ERRORS.zh 的键
  const zhBlockMatch = clientTs.match(/zh:\s*\{([\s\S]*?)\},/);
  assert.ok(zhBlockMatch, '未找到 REMOTE_ERRORS.zh 定义');
  const keysInZh = new Set();
  for (const m of zhBlockMatch[1].matchAll(/['"]([^'"]+)['"]\s*:/g)) {
    keysInZh.add(m[1]);
  }

  // 断言无遗漏、无多余
  assert.deepEqual([...keysInZh].sort(), [...errorsInRemote].sort(), 'REMOTE_ERRORS 键与 remote.ts 错误文案不一致');
});

test('resolveUiLang 对未支持的未知语种安全回退至 en', async () => {
  const { resolveUiLang } = await import('../lib/i18n.js');
  // 未知语言（it、ko、ar、de_unsupported 等）回退至 en
  assert.equal(resolveUiLang('auto', 'it'), 'en');
  assert.equal(resolveUiLang('auto', 'it-IT'), 'en');
  assert.equal(resolveUiLang('auto', 'ko'), 'en');
  assert.equal(resolveUiLang('auto', 'ko-KR'), 'en');
  // 无 hostLocale 回退至 zh
  assert.equal(resolveUiLang('auto', undefined), 'zh');
  assert.equal(resolveUiLang(undefined, undefined), 'zh');
});

test('参数校验错误在多语言环境下抛出对应母语错误提示（非中文残留为0）', async () => {
  const { handleCommand } = await import('../lib/command.js');
  const { StateStore } = await import('../lib/state.js');
  const { SourceCatalog } = await import('../lib/source.js');
  const { CONFIG_DEFAULTS } = await import('../lib/configuration.js');
  const { Session, SESSION_FORMAT_VERSION } = await import('@deepseek-ai/dsh-session');

  const makeAgent = (lang) => {
    const session = Session.create('s1', [], { id: 's1', version: SESSION_FORMAT_VERSION, createdAt: 1, cwd: '/test', isSeeded: false }, 0);
    return {
      agent: { id: 'a1', session },
      store: new StateStore(() => ({ ...CONFIG_DEFAULTS, language: lang, enabled: true })),
      catalog: new SourceCatalog(),
    };
  };

  // 1. 英文环境
  const enEnv = makeAgent('en');
  const badOptEn = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c1', rawInput: '/pua --bad', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.equal(badOptEn.kind, 'error');
  assert.equal(badOptEn.text, 'Unsupported option. Type /pua help to view usage.');

  const badFlavorEn = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c2', rawInput: '/pua flavor nosuch', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.equal(badFlavorEn.kind, 'error');
  assert.equal(badFlavorEn.text, 'Unknown flavor. Type /pua flavor to view available names.');

  const badDashEn = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c3', rawInput: '/pua --', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.equal(badDashEn.kind, 'error');
  assert.equal(badDashEn.text, 'Task description required after --.');

  const badLoopEn = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c4', rawInput: '/pua loop "unclosed', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.equal(badLoopEn.kind, 'error');
  assert.equal(badLoopEn.text, 'Loop parameters have unclosed quotes or invalid syntax. Please enclose task and verify command in quotes.');

  const badExtraEn = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c5', rawInput: '/pua off extra', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.equal(badExtraEn.kind, 'error');
  assert.equal(badExtraEn.text, 'off takes no extra arguments. If your task starts with this keyword, use /pua -- <task>.');

  // 2. 日文环境
  const jaEnv = makeAgent('ja');
  const badOptJa = await handleCommand(jaEnv.store, { agent: jaEnv.agent, commandId: 'c6', rawInput: '/pua --bad', signal: new AbortController().signal }, new Map(), undefined, { catalog: jaEnv.catalog });
  assert.equal(badOptJa.kind, 'error');
  assert.equal(badOptJa.text, 'サポートされていないオプションです。/pua help で使い方を確認してください。');

  const badFlavorJa = await handleCommand(jaEnv.store, { agent: jaEnv.agent, commandId: 'c7', rawInput: '/pua flavor nosuch', signal: new AbortController().signal }, new Map(), undefined, { catalog: jaEnv.catalog });
  assert.equal(badFlavorJa.kind, 'error');
  assert.equal(badFlavorJa.text, '未知のスタイルです。/pua flavor で利用可能な一覧を確認してください。');

  const badDashJa = await handleCommand(jaEnv.store, { agent: jaEnv.agent, commandId: 'c8', rawInput: '/pua --', signal: new AbortController().signal }, new Map(), undefined, { catalog: jaEnv.catalog });
  assert.equal(badDashJa.kind, 'error');
  assert.equal(badDashJa.text, '-- の後にはタスクの説明が必要です。');

  // 3. 法文环境
  const frEnv = makeAgent('fr');
  const badOptFr = await handleCommand(frEnv.store, { agent: frEnv.agent, commandId: 'c9', rawInput: '/pua --bad', signal: new AbortController().signal }, new Map(), undefined, { catalog: frEnv.catalog });
  assert.equal(badOptFr.kind, 'error');
  assert.equal(badOptFr.text, 'Option non prise en charge. Tapez /pua help pour voir l’utilisation.');
});

test('/pua config 非法配置输入返回人性化多语言错误，不返回裸 Zod JSON', async () => {
  const { handleCommand } = await import('../lib/command.js');
  const { StateStore } = await import('../lib/state.js');
  const { SourceCatalog } = await import('../lib/source.js');
  const { CONFIG_DEFAULTS } = await import('../lib/configuration.js');
  const { Session, SESSION_FORMAT_VERSION } = await import('@deepseek-ai/dsh-session');

  const makeAgent = (lang) => {
    const session = Session.create('s1', [], { id: 's1', version: SESSION_FORMAT_VERSION, createdAt: 1, cwd: '/test', isSeeded: false }, 0);
    return {
      agent: { id: 'a1', session },
      store: new StateStore(() => ({ ...CONFIG_DEFAULTS, language: lang, enabled: true })),
      catalog: new SourceCatalog(),
    };
  };

  // 1. 英文
  const enEnv = makeAgent('en');
  const resEn = await handleCommand(enEnv.store, { agent: enEnv.agent, commandId: 'c1', rawInput: '/pua config {"nope":1}', signal: new AbortController().signal }, new Map(), undefined, { catalog: enEnv.catalog });
  assert.equal(resEn.kind, 'error');
  assert.ok(!resEn.text.includes('[{"code":'), '错误文本包含了裸 Zod JSON');
  assert.equal(resEn.text, 'Unrecognized configuration option(s): nope');

  // 2. 中文
  const zhEnv = makeAgent('zh-CN');
  const resZh = await handleCommand(zhEnv.store, { agent: zhEnv.agent, commandId: 'c2', rawInput: '/pua config {"nope":1}', signal: new AbortController().signal }, new Map(), undefined, { catalog: zhEnv.catalog });
  assert.equal(resZh.kind, 'error');
  assert.ok(!resZh.text.includes('[{"code":'), '错误文本包含了裸 Zod JSON');
  assert.equal(resZh.text, '未知配置项：nope');

  // 3. 日文
  const jaEnv = makeAgent('ja');
  const resJa = await handleCommand(jaEnv.store, { agent: jaEnv.agent, commandId: 'c3', rawInput: '/pua config {"nope":1}', signal: new AbortController().signal }, new Map(), undefined, { catalog: jaEnv.catalog });
  assert.equal(resJa.kind, 'error');
  assert.ok(!resJa.text.includes('[{"code":'), '错误文本包含了裸 Zod JSON');
  assert.equal(resJa.text, '未定義の設定項目：nope');
});
