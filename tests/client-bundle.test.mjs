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
  assert.equal(contribution.id, '@michengai/dsh-pua');
  const requireLocal = createRequire(import.meta.url);
  let sharedControls = false;
  const client = contribution.factory(name => {
    if (name === '@deepseek-ai/dsh-client-ui-primitives') {
      sharedControls = true;
      return {
        Button: () => null, Menu: () => null, Switch: () => null, IconChevronDownOutline14: () => null,
        IconChevronUpOutline14: () => null, IconGaugeOutline16: gaugeIcon, IconCloseOutline16: closeIcon,
      };
    }
    return requireLocal(name);
  });
  return { client, sharedControls };
}

test('交付客户端 bundle 经宿主加载器注册配置、入口和状态卡片，卸载释放远程贡献', async () => {
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
    { name: 'settings.plugin.item', id: undefined, key: 'michengai-pua' },
    { name: 'plugins.bundle.config', id: undefined, key: '@michengai/dsh-pua' },
    { name: 'plugins.row.config', id: undefined, key: '@michengai/dsh-pua#michengai-pua' },
    { name: 'conversation.input.left', id: 'michengai-pua', key: undefined },
    { name: 'conversation.input.dock', id: 'michengai-pua', key: undefined },
  ]);
  const row = slots.find(slot => slot.name === 'plugins.row.config');
  const bundle = slots.find(slot => slot.name === 'plugins.bundle.config');
  const composer = slots.find(slot => slot.name === 'conversation.input.left');
  const summary = row.render({ view: 'summary' });
  assert.equal(summary.type(summary.props), '全局默认、角色风味与子代理策略。');
  const page = bundle.render({ view: 'page' });
  assert.equal(typeof page.type, 'function');
  assert.equal(page.props.view, 'page');
  assert.equal(composer.render({}), null, '没有会话时不显示会话写入口');
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
  assert.equal(summary.type(summary.props), 'Global defaults, persona flavor, and subagent policy.');
});

test('斜杠菜单为 /pua 与 /pua-cancel-loop 补官方图标和中文标题，不覆盖已有图标', async () => {
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
  assert.equal(rows[1].label, '催办');
  assert.equal(rows[1].description, '开启 PUA 任务模式、切换风味、换方法或核查验收证据');
  assert.equal(rows[1].hint, '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|任务描述]');
  assert.equal(rows[2].icon, closeIcon);
  assert.equal(rows[2].label, '取消循环');
  assert.equal(rows[2].description, '取消当前会话 PUA Loop，不中断普通模型任务');
  assert.equal(rows[0].description, '压缩');
  assert.equal(rows[3].icon, undefined);
  const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(js, /IconGaugeOutlineRegular/);
  assert.match(js, /IconGaugeOutline16/);
  assert.match(js, /IconCloseOutlineRegular/);
  assert.match(js, /IconCloseOutline16/);
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

test('运行卡片操作按钮与 BTW 一样用圆形图标，不用详情文字', () => {
  const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(js, /\\u5C55\\u5F00/);
  assert.match(js, /pua-activity-actions button\{display:grid/);
  assert.match(js, /width:28px;height:28px;padding:0;border:0;border-radius:50%/);
  assert.doesNotMatch(js, /\\u8BE6\\u60C5/);
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
