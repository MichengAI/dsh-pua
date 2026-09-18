import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

test('交付客户端 bundle 经宿主加载器注册配置、入口和状态卡片，卸载释放远程贡献', async () => {
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
      return { Button: () => null, Menu: () => null, Switch: () => null, IconChevronDownOutline14: () => null };
    }
    return requireLocal(name);
  });
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


test('客户端 sourcemap 来自最终 bundle 并包含依赖模块映射', () => {
  const js = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const map = JSON.parse(readFileSync(new URL('../lib/client.js.map', import.meta.url), 'utf8'));
  assert.match(js, /sourceMappingURL=client.js.map/);
  assert.ok(map.sources.some(source => source.endsWith('/client.ts')));
  assert.ok(map.sources.some(source => source.endsWith('/configuration.ts')));
  assert.ok(map.mappings.length > 0);
  assert.equal(map.sources.length, map.sourcesContent.length);
});
