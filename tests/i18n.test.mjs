import { installToolExecutor } from "./tool-executor.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { UI, ACTIVITY, resolveUiLang, hostLocaleOf, flavorLabel } from '../lib/i18n.js';
import { CONFIG_DEFAULTS, CONFIG_KEYS, configSchema, parsePatch } from '../lib/configuration.js';
import { modeName } from '../lib/display.js';
import { activitySchema } from '../lib/remote-contract.js';
import { materializePreferences } from '../lib/settings.js';

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF]/;

/** 递归收集 copy 表里的全部字符串，跳过函数。 */
function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test('resolveUiLang：手动覆盖优先，auto 跟随宿主 locale', () => {
  assert.equal(resolveUiLang('auto', 'en'), 'en');
  assert.equal(resolveUiLang('auto', 'en-US'), 'en');
  assert.equal(resolveUiLang('auto', 'en_US'), 'en');
  assert.equal(resolveUiLang('auto', 'zh-CN'), 'zh');
  assert.equal(resolveUiLang('auto', undefined), 'zh');
  assert.equal(resolveUiLang(undefined, 'en-GB'), 'en');
  assert.equal(resolveUiLang(undefined, undefined), 'zh');
  assert.equal(resolveUiLang('en', 'zh-CN'), 'en');
  assert.equal(resolveUiLang('zh-CN', 'en-US'), 'zh');
  assert.equal(resolveUiLang('en', undefined), 'en');
});

test('hostLocaleOf：读取宿主 locale 服务的 active 值', () => {
  assert.equal(hostLocaleOf({ get: name => name === 'locale' ? { snapshot: { active: 'en-US' } } : {} }), 'en-US');
  assert.equal(hostLocaleOf({ get: () => ({ snapshot: {} }) }), undefined);
  assert.equal(hostLocaleOf({}), undefined);
  assert.equal(hostLocaleOf({ get: () => null }), undefined);
});

test('UI 文案表：zh 与 en 及全部 8 门语言结构一致，字段覆盖全部配置键', () => {
  const allLangs = ['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt'];
  for (const lang of allLangs) {
    assert.deepEqual(Object.keys(UI[lang]).sort(), Object.keys(UI.zh).sort(), `${lang} 根结构不一致`);
    assert.deepEqual(Object.keys(UI[lang].panel).sort(), Object.keys(UI.zh.panel).sort(), `${lang} panel 结构不一致`);
    assert.deepEqual(Object.keys(UI[lang].panel.loop).sort(), Object.keys(UI.zh.panel.loop).sort(), `${lang} loop 结构不一致`);
    assert.deepEqual(Object.keys(UI[lang].composer).sort(), Object.keys(UI.zh.composer).sort(), `${lang} composer 结构不一致`);
    for (const key of CONFIG_KEYS) assert.ok(UI[lang].fields[key], `${lang} 缺少字段标签：${key}`);
  }
  assert.deepEqual(Object.keys(UI.zh.languageChoices), ['auto', 'zh-CN', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt']);
});

test('UI 中文文案保持现状，不因本地化改动既有界面', () => {
  assert.equal(UI.zh.settingsSummary, '命令与聊天入口、角色风味和子代理策略。');
  assert.equal(UI.zh.cardTitle, 'PUA 配置');
  assert.equal(UI.zh.allow.label, '允许使用 PUA');
  assert.equal(UI.zh.fields.enabled, '开启 PUA');
  assert.equal(UI.zh.fields.verificationTimeout, '验收超时（秒）');
  assert.equal(UI.zh.fields.language, '界面语言');
  assert.equal(UI.zh.autoFlavor, '自动选味');
  assert.equal(UI.zh.panel.globalAria, 'PUA 全局配置');
  assert.equal(UI.zh.panel.sessionAria, 'PUA 会话配置');
  assert.equal(UI.zh.panel.loop.start, '启动 Loop');
  assert.equal(UI.zh.composer.dialogAria, '当前会话 PUA 配置');
  assert.equal(UI.zh.composer.readError, '无法读取全局配置，请检查连接或打开插件配置页重试。');
});

test('UI 英文文案完整存在且不含中文字符', () => {
  const en = strings(UI.en);
  assert.ok(en.length > 60, `英文文案条目过少：${en.length}`);
  for (const text of en) assert.ok(text.length > 0);
  for (const text of en) assert.ok(!CJK.test(text), `英文文案混入中文：${text}`);
  assert.equal(UI.en.settingsSummary, 'Command and chat entry, persona flavor, and subagent policy.');
  assert.equal(UI.en.allow.label, 'Allow PUA');
  assert.equal(UI.en.fields.enabled, 'Enable PUA');
  assert.equal(UI.en.fields.language, 'UI language');
});

test('UI 俄语文案完整存在且不含中文字符', () => {
  const ru = strings(UI.ru);
  assert.ok(ru.length > 60, `俄语文案条目过少：${ru.length}`);
  for (const text of ru) assert.ok(text.length > 0);
  for (const text of ru) assert.ok(!CJK.test(text), `俄语文案混入中文：${text}`);
  assert.equal(UI.ru.settingsSummary, 'Команды и чат-вход, персона-вкус и политика для под-агентов.');
  assert.equal(UI.ru.allow.label, 'Разрешить PUA');
  assert.equal(UI.ru.fields.enabled, 'Включить PUA');
  assert.equal(UI.ru.fields.language, 'Язык интерфейса');
  assert.equal(UI.ru.panel.sessionHeading, 'PUA для этой сессии');
});

test('UI 多语言文案完整存在且各语言文本无缺失', () => {
  for (const lang of ['ja', 'es', 'fr', 'de', 'pt']) {
    const arr = strings(UI[lang]);
    assert.ok(arr.length > 60, `${lang} 文案条目过少：${arr.length}`);
    for (const text of arr) assert.ok(text.length > 0, `${lang} 存在空文案`);
    if (lang !== 'ja') {
      for (const text of arr) assert.ok(!CJK.test(text), `${lang} 文案混入中文：${text}`);
    }
  }
  assert.equal(UI.ja.settingsSummary, 'コマンドとチャット入口、ペルソナスタイルとサブエージェント方針。');
  assert.equal(UI.es.allow.label, 'Permitir PUA');
  assert.equal(UI.fr.fields.enabled, 'Activer PUA');
  assert.equal(UI.de.fields.language, 'UI-Sprache');
  assert.equal(UI.pt.cardTitle, 'Configurações de PUA');
});

test('resolveUiLang：各语言宿主 locale 精准识别', () => {
  assert.equal(resolveUiLang('auto', 'ru'), 'ru');
  assert.equal(resolveUiLang('auto', 'ru-RU'), 'ru');
  assert.equal(resolveUiLang('auto', 'ja'), 'ja');
  assert.equal(resolveUiLang('auto', 'ja_JP'), 'ja');
  assert.equal(resolveUiLang('auto', 'es'), 'es');
  assert.equal(resolveUiLang('auto', 'fr-FR'), 'fr');
  assert.equal(resolveUiLang('auto', 'de'), 'de');
  assert.equal(resolveUiLang('auto', 'pt-BR'), 'pt');
  assert.equal(resolveUiLang('ru', 'en-US'), 'ru');
  assert.equal(resolveUiLang('ja', 'en-US'), 'ja');
  assert.equal(resolveUiLang(undefined, 'ru'), 'ru');
  assert.equal(resolveUiLang(undefined, 'es-ES'), 'es');
});

test('flavorLabel：en 用英文名，zh 用原表，ja 用日文名，未知 id 原样返回', () => {
  assert.equal(flavorLabel('alibaba', 'en'), 'Alibaba');
  assert.equal(flavorLabel('alibaba', 'zh'), '阿里');
  assert.equal(flavorLabel('alibaba', 'ja'), 'アリババ');
  assert.equal(flavorLabel('ding', 'en'), 'DingTalk');
  assert.equal(flavorLabel('custom-x', 'en'), 'custom-x');
  assert.equal(flavorLabel('custom-x', 'zh'), 'custom-x');
});

test('modeName：多语言角色名，未知模式原样返回', () => {
  assert.equal(modeName('pua', 'zh'), '普通 · 持续推进与证据交付');
  assert.equal(modeName('pua-en', 'zh'), '英文协议');
  assert.notEqual(modeName('pua', 'en'), '普通 · 持续推进与证据交付');
  assert.ok(!CJK.test(modeName('pua', 'en')));
  assert.equal(modeName('pua', 'ja'), '標準 · 着実な進行と証拠提出');
  assert.equal(modeName('pua', 'es'), 'Estándar · avance constante y evidencias');
  assert.equal(modeName('unknown-mode', 'en'), 'unknown-mode');
});

test('ACTIVITY 文案表：全量 8 门语言结构一致、中文保持现状', () => {
  for (const lang of ['en', 'ja', 'es', 'fr', 'de', 'ru', 'pt']) {
    assert.deepEqual(Object.keys(ACTIVITY[lang]).sort(), Object.keys(ACTIVITY.zh).sort(), `${lang} 结构不一致`);
    assert.deepEqual(Object.keys(ACTIVITY[lang].fields), Object.keys(ACTIVITY.zh.fields), `${lang} fields 不一致`);
  }
  assert.equal(ACTIVITY.zh.ariaLabel, 'PUA 运行状态');
  assert.equal(ACTIVITY.zh.fields.failures, '连续终端失败观察');
  assert.equal(ACTIVITY.zh.iteration(3, 5), '第 3 轮 / 5 轮');
  assert.equal(ACTIVITY.zh.iteration(3, 0), '第 3 轮');
  assert.equal(ACTIVITY.zh.seconds(120), '120 秒');
  assert.equal(ACTIVITY.zh.times(2), '2 次');
  for (const lang of ['en', 'es', 'fr', 'de', 'ru', 'pt']) {
    for (const text of strings(ACTIVITY[lang])) {
      assert.ok(text.length > 0);
      assert.ok(!CJK.test(text), `${lang} 运行卡片文案混入中文：${text}`);
    }
  }
  assert.equal(ACTIVITY.en.iteration(3, 5), 'Round 3 of 5');
  assert.equal(ACTIVITY.en.iteration(3, 0), 'Round 3');
  assert.equal(ACTIVITY.ja.iteration(3, 5), '第 3 周回 / 5 周回');
  assert.equal(ACTIVITY.ja.fields.rejections, '検証未通過');
});

test('配置契约：language 默认 auto，可覆盖为 8 门内置语言，拒绝未知值', () => {
  assert.equal(CONFIG_DEFAULTS.language, 'auto');
  assert.ok(CONFIG_KEYS.includes('language'));
  assert.deepEqual(parsePatch({ language: 'en' }), { language: 'en' });
  assert.deepEqual(parsePatch({ language: 'ru' }), { language: 'ru' });
  assert.deepEqual(parsePatch({ language: 'ja' }), { language: 'ja' });
  assert.deepEqual(parsePatch({ language: 'es' }), { language: 'es' });
  assert.deepEqual(parsePatch({ language: 'fr' }), { language: 'fr' });
  assert.deepEqual(parsePatch({ language: 'de' }), { language: 'de' });
  assert.deepEqual(parsePatch({ language: 'pt' }), { language: 'pt' });
  assert.equal(parsePatch({ language: null }).language, null);
  assert.equal(configSchema.safeParse({ ...CONFIG_DEFAULTS, language: 'it' }).success, false);
});

test('运行状态契约：activity 携带 language，缺失时校验失败', () => {
  const base = { visible: true, verifying: false, failureCount: 0, loop: null };
  const configuration = { mode: 'pua', flavor: 'auto', subagents: false, language: 'en' };
  assert.equal(activitySchema.safeParse({ ...base, configuration }).success, true);
  assert.equal(activitySchema.safeParse({ ...base, configuration: { mode: 'pua', flavor: 'auto', subagents: false } }).success, false);
});

test('宿主设置 schema：language 字段有默认值，materialize 不丢键', () => {
  assert.equal(materializePreferences({}).language, 'auto');
  assert.equal(materializePreferences({ language: 'en' }).language, 'en');
});
