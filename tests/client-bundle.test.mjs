import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const gaugeIcon = () => null;
const closeIcon = () => null;

function loadClient() {
  let contribution;
  runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: value => { contribution = value; } } },
  });
  assert.equal(contribution.id, '@phucnd0604/dsh-pua-en');
  const requireLocal = createRequire(import.meta.url);
  let sharedControls = false;
  const client = contribution.factory(name => {
    if (name === '@deepseek-ai/dsh-client-ui-primitives') {
      sharedControls = true;
      return {
        Button: () => null, Menu: () => null, Switch: () => null, IconChevronDownOutlineRegular: () => null,
        IconChevronUpOutlineRegular: () => null, IconGaugeOutlineRegular: gaugeIcon, IconCloseOutlineRegular: closeIcon,
      };
    }
    return requireLocal(name);
  });
  return { client, sharedControls };
}

test('client bundle registers config, entries, and status card via host loader; unmount releases the remote contribution', async () => {
  const { client, sharedControls } = loadClient();
  assert.equal(sharedControls, true, '客户端必须复用宿主控件');
  const slots = [];
  let unmounted = false;
  const dispose = await client.apply({
    remote: { $mount: async value => { assert.ok(value); return () => { unmounted = true; }; } },
    get: () => ({}), effect: () => {},
    slots: { inject: (_name, register) => register(), register: (options, render) => { slots.push({ ...options, render }); return () => {}; } },
  });
  assert.deepEqual(slots.map(({ name, id, key }) => ({ name, id, key })), [
    { name: 'settings.plugin.item', id: undefined, key: 'phucnd0604-pua-en' },
    { name: 'plugins.bundle.config', id: undefined, key: '@phucnd0604/dsh-pua-en' },
    { name: 'plugins.row.config', id: undefined, key: '@phucnd0604/dsh-pua-en#phucnd0604-pua-en' },
    { name: 'conversation.input.left', id: 'phucnd0604-pua-en', key: undefined },
    { name: 'conversation.input.dock', id: 'phucnd0604-pua-en', key: undefined },
  ]);
  const row = slots.find(slot => slot.name === 'plugins.row.config');
  const bundle = slots.find(slot => slot.name === 'plugins.bundle.config');
  const composer = slots.find(slot => slot.name === 'conversation.input.left');
  const summary = row.render({ view: 'summary' });
  assert.equal(summary.type(summary.props), 'Command and chat entry, persona flavor, and subagent policy.');
  const page = bundle.render({ view: 'page' });
  assert.equal(typeof page.type, 'function');
  assert.equal(page.props.view, 'page');
  assert.equal(composer.render({}), null, 'no session state renders no composer entry');
  assert.ok(slots[0].render({}));
  dispose(); assert.equal(unmounted, true);
});

test('英文宿主的插件摘要使用英文说明', async () => {
  const { client } = loadClient();
  const slots = [];
  await client.apply({
    remote: { $mount: async () => () => {} },
    get: name => name === 'locale' ? { snapshot: { active: 'en' } } : {},
    effect: () => {},
    slots: { inject: (_name, register) => register(), register: (options, render) => { slots.push({ ...options, render }); return () => {}; } },
  });
  const row = slots.find(slot => slot.name === 'plugins.row.config');
  const summary = row.render({ view: 'summary' });
  assert.equal(summary.type(summary.props), 'Command and chat entry, persona flavor, and subagent policy.');
});

test('slash menu decorates /pua and /pua-cancel-loop with official icons without clobbering existing icons', async () => {
  const { client } = loadClient();
  const keep = () => null;
  const commandUi = {
    candidates: async () => ([
      { name: 'compact', description: '压缩', icon: keep, label: '压缩' },
      { name: 'pua', description: '开启 PUA' },
      { name: 'pua-cancel-loop', description: '取消 Loop' },
      { name: 'other', description: '其他' },
    ]),
  };
  await client.apply({
    remote: { $mount: async () => () => {} },
    get: () => ({}),
    effect: () => {},
    inject: (_deps, callback) => callback({ get: () => commandUi }),
    slots: { inject: (_name, register) => register(), register: () => () => {} },
  });
  const rows = await commandUi.candidates();
  assert.equal(rows[0].icon, keep);
  assert.equal(rows[0].label, '压缩');
  assert.equal(rows[1].icon, gaugeIcon);
  assert.equal(rows[1].label, 'PUA');
  assert.equal(rows[1].description, 'Turn on PUA task mode, switch flavor, change approach, or check verification evidence');
  assert.equal(rows[1].hint, '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|task]');
  assert.equal(rows[2].icon, closeIcon);
  assert.equal(rows[2].label, 'Cancel loop');
  assert.equal(rows[2].description, 'Cancel the current session PUA Loop without interrupting an ordinary model task');
  assert.equal(rows[0].description, '压缩');
  assert.equal(rows[3].icon, undefined);
  const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(js, /IconGaugeOutlineRegular/);
  assert.match(js, /IconCloseOutlineRegular/);
  assert.equal(js.includes('IconGaugeOutline16'), false);
  assert.equal(js.includes('IconCloseOutline16'), false);
  assert.equal(rows[3].label, undefined);
});

test('斜杠菜单英文界面使用英文标题', async () => {
  const { client } = loadClient();
  const commandUi = { candidates: async () => ([{ name: 'pua-cancel-loop', description: 'Cancel the current PUA Loop' }]) };
  await client.apply({
    remote: { $mount: async () => () => {} },
    get: name => name === 'locale' ? { snapshot: { active: 'en' } } : {},
    effect: () => {},
    inject: (_deps, callback) => callback({ get: () => commandUi }),
    slots: { inject: (_name, register) => register(), register: () => () => {} },
  });
  const [row] = await commandUi.candidates();
  assert.equal(row.label, 'Cancel loop');
  assert.equal(row.description, 'Cancel the current session PUA Loop without interrupting an ordinary model task');
  assert.equal(row.icon, closeIcon);
});

test('斜杠菜单描述跟随界面语言，覆盖宿主目录里的中文说明', async () => {
  const { client } = loadClient();
  const commandUi = {
    candidates: async () => ([{ name: 'pua', description: '开启 PUA 任务模式、切换风味、换方法或核查验收证据', hint: '任务描述' }]),
  };
  const remote = { getGlobal: async () => ({ ok: true, value: { values: { enabled: true, language: 'en' } } }) };
  await client.apply({
    remote: { $mount: async () => () => {} },
    get: name => name === 'remote.puaConfig' ? remote : name === 'locale' ? { snapshot: { active: 'zh-CN' } } : {},
    effect: () => {},
    inject: (_deps, callback) => callback({ get: () => commandUi }),
    slots: { inject: (_name, register) => register(), register: () => () => {} },
  });
  const [row] = await commandUi.candidates();
  assert.equal(row.label, 'PUA');
  assert.equal(row.description, 'Turn on PUA task mode, switch flavor, change approach, or check verification evidence');
  assert.equal(row.hint, '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|task]');
});

test('全局关闭后斜杠菜单不列出 PUA 命令', async () => {
  const { client } = loadClient();
  const commandUi = {
    candidates: async () => ([
      { name: 'compact', description: '压缩' },
      { name: 'pua', description: '开启 PUA' },
      { name: 'pua-cancel-loop', description: '取消 Loop' },
    ]),
  };
  const remote = { getGlobal: async () => ({ ok: true, value: { values: { enabled: false } } }) };
  await client.apply({
    remote: { $mount: async () => () => {} },
    get: name => name === 'remote.puaConfig' ? remote : {},
    effect: () => {},
    inject: (_deps, callback) => callback({ get: () => commandUi }),
    slots: { inject: (_name, register) => register(), register: () => () => {} },
  });
  const rows = await commandUi.candidates();
  assert.deepEqual(rows.map(row => row.name), ['compact']);
});

test('聊天入口关闭态绑定电源符号，开启态绑定强调色', () => {
  const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.ok(js.includes('conversation.input.left'), '入口必须注册到聊天栏');
  assert.ok(js.includes('M8 1.6V6.6'), '关闭态必须是电源符号');
  assert.ok(js.includes('IconGaugeOutlineRegular'), '开启态必须用宿主表盘');
  assert.match(js, /"data-on":[^,]{0,80}enabled===!0/);
  assert.ok(js.includes('"data-disabled"'), '关闭态必须有 data-disabled');
  assert.ok(js.includes('.pua-trigger[data-on=true]{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent)}'));
  assert.ok(js.includes('.pua-trigger[data-disabled=true]{color:var(--dsw-alias-label-tertiary)}'));
  assert.equal(js.includes('rotate(-25deg)'), false);
});

test('运行卡片操作按钮与 BTW 一样用圆形图标，不用详情文字', () => {
  const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(js, /\\u5C55\\u5F00/);
  assert.match(js, /pua-activity-actions button\{display:grid/);
  assert.match(js, /width:28px;height:28px;padding:0;border:0;border-radius:50%/);
  assert.doesNotMatch(js, /\\u8BE6\\u60C5/);
});

test('弹窗关闭按钮带 pua-close 样式与图标，且会话面板不暴露语言选择并透传 hostLocale', () => {
  const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(js, /\.pua-close\{position:absolute;right:16px;top:16px;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px/);
  assert.match(js, /\.pua-close svg\{width:16px;height:16px;flex:none\}/);
  assert.ok(js.includes('["enabled","flavor","mode","subagents"]'));
  assert.match(js, /sessionId:[a-z],hostLocale:[a-z],onLoopStarted:/);
});

test('客户端 sourcemap 来自最终 bundle 并包含依赖模块映射', () => {
  const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const map = JSON.parse(readFileSync(new URL('../lib/client.js.map', import.meta.url), 'utf8'));
  assert.match(js, /sourceMappingURL=client.js.map/);
  assert.ok(map.sources.some(source => source.endsWith('/client.ts')));
  assert.ok(map.sources.some(source => source.endsWith('/configuration.ts')));
  assert.ok(map.mappings.length > 0);
  assert.equal(map.sources.length, map.sourcesContent.length);
});
