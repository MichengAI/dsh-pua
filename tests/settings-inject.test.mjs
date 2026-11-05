import test from 'node:test';
import assert from 'node:assert/strict';
import { PreferencesBridge, SETTINGS_NAMESPACE } from '../lib/settings.js';

function guarded(base) {
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key];
      throw new Error(`cannot get property "${String(key)}" without inject`);
    },
  });
}

/**
 * 复刻 cordis 4.1.0 的作用域代理：未在当前作用域声明 inject 的属性访问会直接抛错。
 * 插件 inject 只有 commands / systemPrompt，settings 只在 inject 回调的子作用域可见，
 * 因此任何 `this.ctx.settings` 读法都会把整轮装配打崩（issue #12）。
 */
function scopedContext(shared) {
  const child = { settings: shared, effect: () => {}, inject: () => {} };
  return guarded({ fiber: {}, effect: () => {}, inject: (deps, callback) => { callback(child); } });
}

test('settings 只在 inject 作用域内可见时，读取偏好不再抛 without inject', () => {
  const bridge = new PreferencesBridge(scopedContext({
    get: ns => (ns === SETTINGS_NAMESPACE ? { flavor: 'huawei', alwaysOn: false } : undefined),
    configure: () => () => {},
  }), undefined);
  assert.equal(bridge.configuration().flavor, 'huawei');
  assert.equal(bridge.globallyEnabled(), false);
  assert.equal(bridge.description(), '仅当前会话；全局开关请在「插件」中打开「允许使用 PUA」后修改');
});

test('settings 作用域里没有该命名空间时回落到静态配置', () => {
  const bridge = new PreferencesBridge(scopedContext({
    get: () => undefined,
    configure: () => () => {},
  }), { flavor: 'tencent', alwaysOn: true });
  assert.equal(bridge.configuration().flavor, 'tencent');
  assert.equal(bridge.globallyEnabled(), true);
});

test('没有 settings 服务时不读取 ctx.settings，也不假装存在全局配置', () => {
  const bridge = new PreferencesBridge(guarded({ fiber: {}, effect: () => {}, inject: () => {} }), { flavor: 'tencent', alwaysOn: true });
  assert.equal(bridge.globallyEnabled(), undefined);
  assert.equal(bridge.configuration().enabled, false);
  assert.equal(bridge.description(), '仅当前会话（宿主未提供 settings）');
});

test('settings 作用域销毁后不再持有已失效的实例，并撤销登记', () => {
  let configured = false;
  const disposers = [];
  const child = {
    settings: { get: () => ({ flavor: 'jd' }), configure: () => { configured = true; return () => { configured = false; }; } },
    effect: fn => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); },
  };
  const bridge = new PreferencesBridge({ fiber: {}, effect: () => {}, inject: (deps, callback) => { callback(child); } }, undefined);
  assert.equal(configured, true);
  assert.equal(bridge.configuration().flavor, 'jd');
  disposers.reverse().forEach(dispose => dispose());
  assert.equal(configured, false);
  assert.equal(bridge.globallyEnabled(), undefined);
});
