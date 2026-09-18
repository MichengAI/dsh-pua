// 离线组件验收宿主：运行真实客户端组件，配置 transport 使用浏览器本地夹具。
import React from 'react';
import { createRoot } from 'react-dom/client';
import { apply } from '../src/client.js';
import { CONFIG_DEFAULTS, type Configuration } from '../src/configuration.js';

const h = React.createElement;
let global = { ...CONFIG_DEFAULTS }, revision = 0;
const overrides: Record<string, Partial<Configuration>> = {};
const revisions: Record<string, number> = {};
const sessionReads: Record<string, number> = {};
let fail = false;
let activity = 'idle';
const snapshot = (id?: string) => ({ values: { ...global, ...(id ? overrides[id] : {}) }, defaults: global, overrides: id ? overrides[id] ?? {} : {}, revision: id ? revisions[id] ?? 0 : revision, child: false });
const response = async (fn: () => unknown) => { await new Promise(resolve => setTimeout(resolve, 150)); try { return { ok: true, value: fn() }; } catch (error) { return { ok: false, error: { message: String(error) } }; } };
const check = (expected: number, current: number) => { if (fail) { fail = false; throw Error('模拟保存失败，请重试'); } if (expected !== current) throw Error('配置已被其他窗口修改，请重新读取'); };
const remote = {
  getActivity: (id: string) => response(() => ({ configuration: { mode: snapshot(id).values.mode, flavor: snapshot(id).values.flavor, subagents: snapshot(id).values.subagents }, visible: activity !== 'idle' && snapshot(id).values.enabled && global.enabled, verifying: activity === 'verify', failureCount: 0, loop: ['loop', 'verify'].includes(activity) ? { iteration: 2, maxIterations: 5, rejections: 1, verification: "command", verificationTimeout: 120 } : null })),
  getGlobal: () => response(() => snapshot()),
  setGlobal: (values: Configuration, expected: number) => response(() => { check(expected, revision); global = values; revision++; return snapshot(); }),
  getSession: (id: string) => response(() => {
    sessionReads[id] = (sessionReads[id] ?? 0) + 1;
    // 用 #session-loading 复现宿主新会话最初两次读取尚未就绪。
    if (location.hash === '#session-loading' && sessionReads[id] <= 2) throw Error('会话尚未加载');
    return snapshot(id);
  }),
  setSession: (id: string, patch: Record<string, unknown>, expected: number) => response(() => { check(expected, revisions[id] ?? 0); const next: Record<string, unknown> = { ...overrides[id] }; for (const [key, value] of Object.entries(patch)) { if (value === null) delete next[key]; else next[key] = value; } overrides[id] = next; revisions[id] = (revisions[id] ?? 0) + 1; return snapshot(id); }),
  startLoop: () => response(() => { if (fail) { fail = false; throw Error('模拟启动失败'); } activity = 'loop'; return { text: '测试夹具：Loop 已提交，未执行命令或调用模型。' }; }),
  cancelLoop: () => response(() => { activity = 'idle'; return { text: '测试夹具：Loop 已取消。' }; }),
};
const seats = new Map<string, (props: { sessionId?: string; session?: { sessionId: string }; view?: 'summary' | 'page' }) => React.ReactNode>();
await apply({ remote: { $mount: async () => () => {} }, get: () => remote, effect: fn => { fn(); },
  slots: { inject: (_name, callback) => callback(), register: (options, render) => { seats.set(options.name, render); return () => {}; } } });
function App() {
  const [page, setPage] = React.useState('settings');
  return h('main', null, h('header', null, h('strong', null, 'PUA 配置 · 离线组件验收'), h('p', null, '使用实际插件组件；此页面不连接本机 DSH，不修改真实配置。')),
    h('nav', null, ['settings', '会话 A', '会话 B'].map(id => h('button', { key: id, onClick: () => setPage(id), 'aria-pressed': page === id }, id === 'settings' ? '插件 → PUA 配置' : id)), h('button', { onClick: () => { fail = true; } }, '模拟下次保存失败'), h('button', { onClick: () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; } }, '切换明暗主题')),
    page === 'settings' ? h('article', { key: page }, h('p', null, seats.get('plugins.row.config')?.({ view: 'summary' })), seats.get('plugins.bundle.config')?.({ view: 'page' })) : h('article', { key: page }, h('h1', null, page), h('p', null, '配置仅覆盖当前会话；打开 PUA 查看继承与自定义状态。'), h('div', null, [['idle', '结束任务'], ['running', '开始任务'], ['loop', '开始 Loop'], ['verify', '正在验收']].map(([value, label]) => h('button', { key: value, onClick: () => { activity = value; } }, label))), seats.get('conversation.input.dock')?.({ session: { sessionId: page } }), h('textarea', { placeholder: '聊天输入区（仅布局示意）', rows: 4 }), h('div', { className: 'composer' }, h('span', null, '权限 · 默认'), seats.get('conversation.input.left')?.({ sessionId: page }), h('span', { style: { order: 1 } }, '专家'))));
}
createRoot(document.getElementById('root')!).render(h(App));
