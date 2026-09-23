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

/** 旧宿主使用 SettingsProvider；0.1.7 用内存服务提交 volatile 引用。 */
export async function installSettings(ctx) {
  const state = { fail: false, config: undefined, revision: 0, listed: false };
  const { SettingsProvider } = await import('@deepseek-ai/dsh-settings');
  if (typeof SettingsProvider === 'function') {
    class MemorySettings extends SettingsProvider {
      writable = true;
      async load() { return {}; }
      async persist() { if (state.fail) throw new Error('模拟磁盘写入失败'); }
    }
    new MemorySettings(ctx);
    return { fail(value) { state.fail = value; }, attach() {} };
  }
  class VolatileMemorySettings extends Service {
    constructor(context) { super(context, 'settings'); }
    configure() {
      state.listed = true;
      return () => { state.listed = false; };
    }
    get(ns) { return ns === 'michengai-pua' ? snapshot(state.config) : undefined; }
    describe() {
      return state.listed ? [{ ns: 'michengai-pua', revision: state.revision, value: snapshot(state.config) }] : [];
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
