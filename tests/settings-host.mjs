import { Service } from '@deepseek-ai/cordis';

const WRITE = Symbol.for('cosmokit.volatile.write');

function commit(config, patch) {
  if (!config || typeof config !== 'object') throw new Error('PUA 配置尚未挂载。');
  if (typeof config.get === 'function' && WRITE in config) {
    config[WRITE]({ ...config.get(), ...patch });
    return;
  }
  for (const [key, value] of Object.entries(patch)) {
    const current = config[key];
    if (current && typeof current === 'object' && WRITE in current) current[WRITE](value);
    else config[key] = value;
  }
}

function snapshot(config) {
  if (config && typeof config.get === 'function') return config.get();
  return config;
}

/** 0.2.0 起没有 SettingsProvider，用内存服务提交 volatile 引用。 */
export async function installSettings(ctx) {
  const state = { fail: false, config: undefined, revision: 0, listed: false };
  class VolatileMemorySettings extends Service {
    constructor(context) { super(context, 'settings'); }
    configure() {
      state.listed = true;
      return () => { state.listed = false; };
    }
    get(ns) { return ns === 'phucnd0604-pua-en' ? snapshot(state.config) : undefined; }
    describe() {
      return state.listed ? [{ ns: 'phucnd0604-pua-en', revision: state.revision, value: snapshot(state.config) }] : [];
    }
    async update(_ns, patch, expected) {
      if (state.fail) throw new Error('模拟磁盘写入失败');
      if (expected !== undefined && expected !== state.revision) {
        throw new Error(`settings namespace changed since it was read (expected revision ${expected}, now ${state.revision})`);
      }
      commit(state.config, patch);
      state.revision += 1;
    }
  }
  new VolatileMemorySettings(ctx);
  return { fail(value) { state.fail = value; }, attach(config) { state.config = config; } };
}
