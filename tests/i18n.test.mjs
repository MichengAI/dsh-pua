import test from 'node:test';
import assert from 'node:assert/strict';
import { UI, ACTIVITY, resolveUiLang, hostLocaleOf, flavorLabel } from '../lib/i18n.js';
import { CONFIG_DEFAULTS, CONFIG_KEYS, configSchema, parsePatch } from '../lib/configuration.js';
import { modeName } from '../lib/display.js';
import { activitySchema } from '../lib/remote-contract.js';
import { materializePreferences } from '../lib/settings.js';

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF]/;

/** Recursively collects every string in a copy table, skipping functions. */
function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test('resolveUiLang: a manual override wins and auto follows the host locale', () => {
  assert.equal(resolveUiLang('auto', 'en'), 'en');
  assert.equal(resolveUiLang('auto', 'en-US'), 'en');
  assert.equal(resolveUiLang('auto', 'en_US'), 'en');
  assert.equal(resolveUiLang('auto', 'zh-CN'), 'zh');
  assert.equal(resolveUiLang('auto', undefined), 'en');
  assert.equal(resolveUiLang(undefined, 'en-GB'), 'en');
  assert.equal(resolveUiLang(undefined, undefined), 'en');
  assert.equal(resolveUiLang('en', 'zh-CN'), 'en');
  assert.equal(resolveUiLang('zh-CN', 'en-US'), 'zh');
  assert.equal(resolveUiLang('en', undefined), 'en');
});

test('hostLocaleOf: reads the active value of the host locale service', () => {
  assert.equal(hostLocaleOf({ get: name => name === 'locale' ? { snapshot: { active: 'en-US' } } : {} }), 'en-US');
  assert.equal(hostLocaleOf({ get: () => ({ snapshot: {} }) }), undefined);
  assert.equal(hostLocaleOf({}), undefined);
  assert.equal(hostLocaleOf({ get: () => null }), undefined);
});

test('UI copy table: zh and en share the same structure and fields cover every configuration key', () => {
  assert.deepEqual(Object.keys(UI.en).sort(), Object.keys(UI.zh).sort());
  assert.deepEqual(Object.keys(UI.en.panel).sort(), Object.keys(UI.zh.panel).sort());
  assert.deepEqual(Object.keys(UI.en.panel.loop).sort(), Object.keys(UI.zh.panel.loop).sort());
  assert.deepEqual(Object.keys(UI.en.composer).sort(), Object.keys(UI.zh.composer).sort());
  for (const lang of ['zh', 'en', 'ru']) {
    for (const key of CONFIG_KEYS) assert.ok(UI[lang].fields[key], `${lang} is missing a field label: ${key}`);
  }
  assert.deepEqual(Object.keys(UI.zh.languageChoices), ['auto', 'zh-CN', 'en', 'ru']);
});

test('UI Chinese copy stays as-is; localization does not change the existing interface', () => {
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

test('UI English copy exists in full and contains no CJK characters', () => {
  const en = strings(UI.en);
  assert.ok(en.length > 60, `Too few English copy entries: ${en.length}`);
  for (const text of en) assert.ok(text.length > 0);
  for (const text of en) assert.ok(!CJK.test(text), `English copy contains CJK characters: ${text}`);
  assert.equal(UI.en.settingsSummary, 'Command and chat entry, persona flavor, and subagent policy.');
  assert.equal(UI.en.allow.label, 'Allow PUA');
  assert.equal(UI.en.fields.enabled, 'Enable PUA');
  assert.equal(UI.en.fields.language, 'UI language');
});

test('UI Russian copy exists in full and contains no CJK characters', () => {
  const ru = strings(UI.ru);
  assert.ok(ru.length > 60, `Too few Russian copy entries: ${ru.length}`);
  for (const text of ru) assert.ok(text.length > 0);
  for (const text of ru) assert.ok(!CJK.test(text), `Russian copy contains CJK characters: ${text}`);
  assert.equal(UI.ru.settingsSummary, 'Команды и чат-вход, персона-вкус и политика для под-агентов.');
  assert.equal(UI.ru.allow.label, 'Разрешить PUA');
  assert.equal(UI.ru.fields.enabled, 'Включить PUA');
  assert.equal(UI.ru.fields.language, 'Язык интерфейса');
  assert.equal(UI.ru.panel.sessionHeading, 'PUA для этой сессии');
});

test('resolveUiLang: a Russian host locale resolves to ru', () => {
  assert.equal(resolveUiLang('auto', 'ru'), 'ru');
  assert.equal(resolveUiLang('auto', 'ru-RU'), 'ru');
  assert.equal(resolveUiLang('ru', 'en-US'), 'ru');
  assert.equal(resolveUiLang(undefined, 'ru'), 'ru');
});

test('flavorLabel: en uses English names, zh uses the original table, and an unknown id is returned as-is', () => {
  assert.equal(flavorLabel('alibaba', 'en'), 'Alibaba');
  assert.equal(flavorLabel('alibaba', 'zh'), 'Alibaba');
  assert.equal(flavorLabel('ding', 'en'), 'DingTalk');
  assert.equal(flavorLabel('custom-x', 'en'), 'custom-x');
  assert.equal(flavorLabel('custom-x', 'zh'), 'custom-x');
});

test('modeName: bilingual role names; an unknown mode is returned as-is', () => {
  assert.equal(modeName('pua', 'zh'), '普通 · 持续推进与证据交付');
  assert.equal(modeName('pua-en', 'zh'), '英文协议');
  assert.notEqual(modeName('pua', 'en'), '普通 · 持续推进与证据交付');
  assert.ok(!CJK.test(modeName('pua', 'en')));
  assert.equal(modeName('unknown-mode', 'en'), 'unknown-mode');
});

test('ACTIVITY copy table: same structure, Chinese stays as-is, and English contains no CJK', () => {
  assert.deepEqual(Object.keys(ACTIVITY.en).sort(), Object.keys(ACTIVITY.zh).sort());
  assert.deepEqual(Object.keys(ACTIVITY.en.fields), Object.keys(ACTIVITY.zh.fields));
  assert.equal(ACTIVITY.zh.ariaLabel, 'PUA 运行状态');
  assert.equal(ACTIVITY.zh.fields.failures, '连续终端失败观察');
  assert.equal(ACTIVITY.zh.iteration(3, 5), '第 3 轮 / 5 轮');
  assert.equal(ACTIVITY.zh.iteration(3, 0), '第 3 轮');
  assert.equal(ACTIVITY.zh.seconds(120), '120 秒');
  assert.equal(ACTIVITY.zh.times(2), '2 次');
  for (const text of strings(ACTIVITY.en)) {
    assert.ok(text.length > 0);
    assert.ok(!CJK.test(text), `English activity-card copy contains CJK characters: ${text}`);
  }
  assert.equal(ACTIVITY.en.iteration(3, 5), 'Round 3 of 5');
  assert.equal(ACTIVITY.en.iteration(3, 0), 'Round 3');
});

test('Configuration contract: language defaults to auto, can be overridden to zh-CN / en / ru, and rejects unknown values', () => {
  assert.equal(CONFIG_DEFAULTS.language, 'auto');
  assert.ok(CONFIG_KEYS.includes('language'));
  assert.deepEqual(parsePatch({ language: 'en' }), { language: 'en' });
  assert.deepEqual(parsePatch({ language: 'ru' }), { language: 'ru' });
  assert.equal(parsePatch({ language: null }).language, null);
  assert.equal(configSchema.safeParse({ ...CONFIG_DEFAULTS, language: 'fr' }).success, false);
});

test('Runtime state contract: activity carries language and fails validation when it is missing', () => {
  const base = { visible: true, verifying: false, failureCount: 0, loop: null };
  const configuration = { mode: 'pua', flavor: 'auto', subagents: false, language: 'en' };
  assert.equal(activitySchema.safeParse({ ...base, configuration }).success, true);
  assert.equal(activitySchema.safeParse({ ...base, configuration: { mode: 'pua', flavor: 'auto', subagents: false } }).success, false);
});

test('Host settings schema: the language field has a default and materialize does not drop keys', () => {
  assert.equal(materializePreferences({}).language, 'auto');
  assert.equal(materializePreferences({ language: 'en' }).language, 'en');
});
