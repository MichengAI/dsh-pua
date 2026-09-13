import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Menu, Switch, IconChevronDownOutline14, IconGaugeOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import { CONFIG_DEFAULTS, CONFIG_KEYS, CONFIG_MODES, configSchema, parsePatch, type Configuration, type ConfigurationPatch } from './configuration.js';
import { FLAVORS } from './flavors.js';
import { watchComposerConfiguration } from './client-refresh.js';
import { ActivityCard, ACTIVITY_CSS } from './activity-card.js';
import { TYPERT_REMOTE, type ConfigurationSnapshot, type PuaRemoteApi } from './remote-contract.js';

const h = React.createElement;
type Key = keyof Configuration;
interface ClientContext {
  slots: { inject(name: string, register: () => () => void): () => void;
    register(options: { name: string; id?: string; key?: string; order?: number; label?: string }, render: (props: { sessionId?: string; session?: { sessionId: string } }) => React.ReactNode): () => void };
  remote: { $mount(contribution: TypertRemoteContribution): Promise<() => void> };
  get(name: string): unknown;
  effect(callback: () => () => void): void;
}
export const inject = ['slots', 'remote'];
const labels: Record<Key, string> = {
  enabled: '开启 PUA', flavor: '风味', mode: '角色模式', subagents: '对子代理启用 PUA',
  terminalReview: '终端异常核验提醒', failureCandidates: '失败升级候选提示', qualityTriggers: '质量纠偏提示',
  offline: '反馈提醒', feedbackFrequency: '反馈提醒频率', maxIterations: 'Loop 轮次上限', verify: '默认验收命令', verificationTimeout: '验收超时（秒）',
};
import { modeNames } from './display.js';
const choices: Partial<Record<Key, readonly { value: string; label: string }[]>> = {
  flavor: [{ value: 'auto', label: '自动选味' }, ...FLAVORS.map(item => ({ value: item.id, label: item.label }))],
  mode: CONFIG_MODES.map(value => ({ value, label: modeNames[value]! })),
};
const descriptions: Partial<Record<Key, string>> = {
  subagents: '默认关闭，避免干扰专家插件。开启后继承父会话生效配置，不继承循环或失败计数。',
  maxIterations: '0 表示不限轮次。保存配置不会启动 Loop。',
  verify: '留空使用模型报告，不代表独立验收通过。命令在会话工作目录执行，启动时可修改。',
  verificationTimeout: '已启动的 Loop 保持启动时确认的参数。',
  feedbackFrequency: '每多少次有 PUA 可见输出的交付提醒一次，0 关闭。插件不上传反馈。',
};
async function unwrap<T>(result: Promise<RemoteResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) throw new Error(response.error.message);
  return response.value;
}
const message = (error: unknown): string => {
  const text = error instanceof Error ? error.message : '保存失败，请重试。';
  try {
    const issues = JSON.parse(text) as { path?: string[]; code?: string; maximum?: number; minimum?: number }[];
    if (Array.isArray(issues)) return issues.map(issue => {
      const field = labels[issue.path?.[0] as Key] ?? '配置';
      return field + (issue.code === 'too_big' ? '不能超过 ' + issue.maximum : issue.code === 'too_small' ? '不能小于 ' + issue.minimum : '的值无效，请检查输入');
    }).join('；');
  } catch { /* 普通远程错误保留原文。 */ }
  return text;
};
/** 菜单、选中标记及键盘交互复用宿主公共组件。 */
function PuaSelect({ id, value, options, disabled, onChange }: {
  id: string; value: string; options: readonly { value: string; label: string }[]; disabled: boolean; onChange: (value: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  return h(Menu, { className: 'pua-shared-menu', align: 'end', open: open && !disabled, autoFocus: true, items: options.map(option => ({ id: option.value, label: option.label })),
    selectedId: value, onClose: () => setOpen(false), onSelect: next => { setOpen(false); if (next !== value) onChange(next); },
    anchor: h(Button, { id, type: 'button', variant: 'toolbar', className: 'pua-select-trigger', disabled, 'aria-haspopup': 'menu', 'aria-expanded': open,
      onClick: () => setOpen(!open) }, h('span', { className: 'pua-select-label' }, options.find(option => option.value === value)?.label), h(IconChevronDownOutline14)),
  });
}

/** 官方 PluginCard 未公开导出；此壳沿用其按钮结构与主题 token，控件复用 primitives。 */
function PuaSettingsCard({ remote }: { remote: PuaRemoteApi }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return h('li', { className: 'pua-settings-card', 'data-open': open },
    h('button', { type: 'button', className: 'pua-card-header', 'aria-expanded': open, 'aria-label': `${open ? '收起' : '展开'}：PUA 配置`, onClick: () => setOpen(!open) },
      h('span', { className: 'pua-card-text' }, h('span', { className: 'pua-card-name' }, 'PUA 配置'), h('span', { className: 'pua-card-description' }, '全局默认、角色风味与子代理策略。')),
      h(IconChevronDownOutline14, { className: 'pua-card-chevron' })),
    h('div', { className: 'pua-card-body', hidden: !open }, h(ConfigurationPanel, { remote })));
}
/** 两个入口共享字段与校验；会话入口永远不调用全局写入方法。 */
export function ConfigurationPanel({ remote, sessionId, onLoopStarted }: { remote: PuaRemoteApi; sessionId?: string | undefined; onLoopStarted?: () => void }): React.ReactElement {
  const [snapshot, setSnapshot] = useState<ConfigurationSnapshot>();
  const [draft, setDraft] = useState<Configuration>(CONFIG_DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('正在读取配置…');
  const [error, setError] = useState('');
  const [task, setTask] = useState('');
  const [loopValues, setLoopValues] = useState<Configuration>();
  const live = useRef(true);
  const saving = useRef(false);
  const epoch = useRef(0);
  const global = !sessionId;
  const accept = (value: ConfigurationSnapshot) => { if (live.current) { setSnapshot(value); setDraft(value.values); setDirty(false); setError(''); setStatus('配置已同步'); } };
  const refresh = () => {
    const request = ++epoch.current;
    return unwrap(global ? remote.getGlobal() : remote.getSession(sessionId!)).then(value => { if (request === epoch.current) accept(value); }).catch(reason => { if (live.current && request === epoch.current) setError(message(reason)); });
  };
  useEffect(() => { live.current = true; void refresh(); return () => { live.current = false; }; }, [sessionId]);
  // 未编辑时同步其他窗口和命令修改；输入草稿不被后台刷新覆盖。
  useEffect(() => {
    const update = () => { if (!dirty && !error && !saving.current) void refresh(); };
    const timer = window.setInterval(update, 4000);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, [dirty, error, sessionId]);
  async function save(patch?: ConfigurationPatch) {
    if (!snapshot || saving.current) return;
    ++epoch.current;
    saving.current = true; setBusy(true); setError(''); setStatus('正在保存…');
    try {
      const saved = await unwrap(global ? remote.setGlobal(configSchema.parse(draft), snapshot.revision) : remote.setSession(sessionId!, parsePatch(patch ?? {}), snapshot.revision));
      accept(saved);
      setStatus(!global && patch?.enabled === true && !saved.values.enabled ? '已保存；实际开关受父会话与子代理策略限制，请以下方状态为准' : '已保存 · 从下一模型步骤生效');
    } catch (reason) { setError(message(reason)); setStatus('未保存'); }
    finally { saving.current = false; setBusy(false); }
  }
  function field(key: Key) {
    const overridden = snapshot && Object.hasOwn(snapshot.overrides, key);
    const id = `pua-${sessionId ?? 'global'}-${key}`;
    const value = draft[key];
    const update = (next: Configuration[Key]) => { ++epoch.current; setDraft(previous => ({ ...previous, [key]: next })); setDirty(true); };
    const options = choices[key];
    const input = typeof value === 'boolean'
      ? h(Switch, { checked: key === 'offline' ? !value : value, label: labels[key], disabled: busy,
        onChange: next => { const parsed = key === 'offline' ? !next : next; if (global) update(parsed); else void save({ [key]: parsed }); } })
      : options ? h(PuaSelect, { id, value: String(value), disabled: busy, options,
        onChange: next => { if (global) update(next); else void save({ [key]: next }); } })
      : h(key === 'verify' ? 'textarea' : 'input', { id, value: typeof value === 'number' && Number.isNaN(value) ? '' : value, disabled: busy,
        ...(key === 'verify' ? { rows: 2, maxLength: 8192 } : { type: 'number', min: key === 'verificationTimeout' ? 1 : 0, max: key === 'maxIterations' ? 10000 : key === 'verificationTimeout' ? 3600 : 9999, step: 1 }),
        onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(typeof value === 'number' ? event.target.value === '' ? NaN : Number(event.target.value) : event.target.value),
        onBlur: () => { if (!global && dirty) void save({ [key]: draft[key] }); } });
    if (typeof value === 'boolean') return h('div', { className: 'pua-field', key },
      h('label', { className: 'pua-toggle-row' }, h('span', null, labels[key]), input),
      !global && overridden && h('span', { className: 'pua-override' }, h('small', null, '已自定义'),
        h(Button, { disabled: busy, 'aria-label': '恢复' + labels[key] + '默认值', onClick: () => void save({ [key]: null }) }, '恢复默认')),
      descriptions[key] && h('small', null, descriptions[key]));
    return h('div', { className: 'pua-field', key, 'data-inline': !!options },
      h('div', { className: 'pua-field-head' }, h('label', { htmlFor: id }, labels[key])), input,
      !global && overridden && h('span', { className: 'pua-override' }, h('small', null, '已自定义'),
        h(Button, { disabled: busy, 'aria-label': `恢复${labels[key]}默认值`, onClick: () => void save({ [key]: null }) }, '恢复默认')),
      descriptions[key] && h('small', null, descriptions[key]));
  }
  async function loop(start: boolean) {
    if (!sessionId || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { const result = await unwrap(start ? remote.startLoop(sessionId, task, configSchema.parse(loopValues ?? draft)) : remote.cancelLoop(sessionId)); if (start && onLoopStarted) { onLoopStarted(); return; } await refresh(); setStatus(result.text); }
    catch (reason) { setError(message(reason)); }
    finally { saving.current = false; setBusy(false); }
  }
  return h('section', { className: global ? 'pua-panel pua-panel-global' : 'pua-panel', 'aria-label': global ? 'PUA 全局配置' : 'PUA 会话配置' },
    !global && h('h2', null, '当前会话 PUA'),
    h('p', { className: 'pua-muted' }, global ? '保存为当前 DSH profile 的全局默认；已有会话自定义项保持不变。' : `仅影响当前会话 · 已自定义 ${Object.keys(snapshot?.overrides ?? {}).length} 项。全局默认只能在设置 → 插件 → 插件配置 → PUA 配置修改。`),
    !global && snapshot && h('div', { className: 'pua-session-actions' },
      h(Button, { disabled: busy || !Object.keys(snapshot.overrides).length, onClick: () => void save(Object.fromEntries(CONFIG_KEYS.map(key => [key, null]))) }, '恢复全部继承'),
      h('span', { role: 'status', 'aria-live': 'polite' }, busy ? '正在保存…' : dirty ? '有未保存的修改' : status.startsWith('已保存；') ? status : '')),
    snapshot?.child && h('p', { className: 'pua-muted' }, '子代理的未覆盖项继承父会话生效值；父会话关闭或不允许对子代理启用时，本会话不能强制开启。'),
    error && h('div', { role: 'alert', className: 'pua-error' }, error, h(Button, { onClick: () => void refresh(), disabled: busy }, '重新读取配置')),
    snapshot && h(React.Fragment, null, ['enabled', 'flavor', 'mode', 'subagents'].map(key => field(key as Key)),
      h('details', null, h('summary', null, '提醒与 Loop 默认参数'), CONFIG_KEYS.filter(key => !['enabled', 'flavor', 'mode', 'subagents'].includes(key)).map(field)),
      global && h('div', { className: 'pua-settings-footer' }, h(React.Fragment, null, h('button', { type: 'button', className: 'pua-settings-discard', disabled: busy || !dirty, onClick: () => { ++epoch.current; accept(snapshot); } }, '放弃修改'), h('button', { type: 'button', className: 'pua-settings-save', disabled: busy || !dirty, onClick: () => void save() }, busy ? '保存中…' : '保存'))),
      !global && h('details', { onToggle: (event: React.SyntheticEvent<HTMLDetailsElement>) => { if (event.currentTarget.open && !loopValues) setLoopValues({ ...draft }); } },
        h('summary', null, '启动或取消 Loop'), h('p', { className: 'pua-muted' }, '下方参数只用于本次启动，不修改默认设置。'),
        h('label', null, '任务', h('textarea', { value: task, rows: 2, maxLength: 4096, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setTask(event.target.value) })),
        h('label', null, '本次验收命令（留空使用模型报告）', h('textarea', { value: (loopValues ?? draft).verify, rows: 2, maxLength: 8192, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setLoopValues({ ...(loopValues ?? draft), verify: event.target.value }) })),
        h('label', null, '本次轮次上限（0 不限）', h('input', { type: 'number', min: 0, max: 10000, value: (loopValues ?? draft).maxIterations, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setLoopValues({ ...(loopValues ?? draft), maxIterations: Number(event.target.value) }) })),
        h('label', null, '本次验收超时（秒）', h('input', { type: 'number', min: 1, max: 3600, value: (loopValues ?? draft).verificationTimeout, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setLoopValues({ ...(loopValues ?? draft), verificationTimeout: Number(event.target.value) }) })),
        h('div', { className: 'pua-actions' }, h(Button, { variant: 'primary', disabled: busy || !task.trim(), onClick: () => void loop(true) }, '启动 Loop'), h(Button, { disabled: busy, onClick: () => void loop(false) }, '取消当前 Loop')))));
}

function ComposerButton({ remote, sessionId }: { remote: PuaRemoteApi; sessionId: string }): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [readError, setReadError] = useState('');
  const [snapshot, setSnapshot] = useState<ConfigurationSnapshot>();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const watcher = watchComposerConfiguration(remote, sessionId, enabled => {
      setGlobalEnabled(enabled);
      if (!enabled) setOpen(false);
    }, setSnapshot, setReadError);
    window.addEventListener('focus', watcher.refresh);
    return () => { watcher.dispose(); window.removeEventListener('focus', watcher.refresh); };
  }, [remote, sessionId, open]);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  const disabled = snapshot?.values.enabled === false;
  if (!globalEnabled) return null;
  return h('div', { className: 'pua-composer' }, h('button', { ref: trigger, className: 'pua-trigger', disabled: !snapshot || !!readError, 'aria-busy': !snapshot, 'data-disabled': disabled, 'aria-label': !snapshot ? 'PUA（正在读取会话配置）' : disabled ? 'PUA（当前会话已关闭）' : 'PUA（当前会话已开启）', 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: () => setOpen(true), title: readError || (!snapshot ? '正在读取会话配置' : disabled ? 'PUA 已关闭，点击配置' : 'PUA 已开启，点击配置') }, h('span', { className: 'pua-entry-icon', 'aria-hidden': true }, h(IconGaugeOutline16)), h('span', { className: 'pua-entry-label' }, 'PUA')),
    open && createPortal(h('dialog', { ref: dialog, className: 'pua-dialog', 'aria-label': '当前会话 PUA 配置', onKeyDownCapture: (event: React.KeyboardEvent) => { if (event.key === 'Escape' && dialog.current?.querySelector('[role=menu]')) event.preventDefault(); }, onCancel: close, onClick: (event: React.MouseEvent<HTMLDialogElement>) => { if (event.target === dialog.current) close(); } },
      h('div', { className: 'pua-dialog-content' }, h('button', { className: 'pua-close', onClick: close, 'aria-label': '关闭配置面板' }, '关闭'), h(ConfigurationPanel, { key: sessionId, remote, sessionId, onLoopStarted: close }))), document.body));
}
// 全局页脚沿用官方 PluginCard 的按钮样式与布局，公共 Button 用于其余操作。
const CSS = `.pua-panel.pua-panel-global{max-width:none}.pua-settings-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 0 4px;border-top:0.5px solid var(--dsw-alias-border-l2)}.pua-settings-discard,.pua-settings-save{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer}.pua-settings-discard{border-color:var(--dsw-alias-border-l2);background:none;color:var(--dsw-alias-label-secondary)}.pua-settings-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.pua-settings-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.pua-settings-discard:disabled,.pua-settings-save:disabled{opacity:.4;cursor:default}.pua-settings-discard:focus-visible,.pua-settings-save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.pua-settings-card{list-style:none;border:0.5px solid var(--dsw-alias-border-l4);border-radius:16px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}.pua-settings-card:hover{border-color:var(--dsw-alias-label-dimmed)}.pua-settings-card[data-open=true]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.pua-card-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}.pua-card-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.pua-card-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}.pua-card-description{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}.pua-card-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s}.pua-settings-card[data-open=true] .pua-card-chevron{transform:rotate(180deg)}.pua-card-body{border-top:0.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.pua-select-trigger{gap:12px;max-width:100%}.pua-select-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pua-select-trigger svg{flex:none}.pua-shared-menu{max-width:min(260px,55vw)}.pua-trigger[data-disabled=true]{position:relative}.pua-trigger[data-disabled=true]::after{content:'';position:absolute;left:6px;right:6px;top:50%;height:1px;background:currentColor;transform:rotate(-25deg);pointer-events:none}.pua-shared-menu [role=menu]{max-height:240px;overflow-y:auto}.pua-field[data-inline=true]{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 12px}.pua-field[data-inline=true]>.pua-field-head{margin:0}.pua-field[data-inline=true]>small{grid-column:1/-1}.pua-card-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.pua-composer{display:inline-flex;order:2;flex:none}.pua-trigger{border:0;border-radius:20px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;min-height:28px;padding:0 8px;cursor:pointer;white-space:nowrap}.pua-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}.pua-dialog{width:min(480px,calc(100vw - 32px));max-height:calc(100dvh - 48px);padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#222)}.pua-dialog::backdrop{background:#0005}.pua-dialog-content{position:relative;padding:22px}.pua-close{position:absolute;right:16px;top:16px}.pua-panel{max-width:700px;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}.pua-panel h2{font-size:19px;margin:0 60px 8px 0}.pua-muted,.pua-panel small,.pua-status{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}.pua-field{margin:0;padding:12px 0}.pua-field+.pua-field{border-top:0.5px solid var(--dsw-alias-border-l2)}.pua-field[data-inline=true]>.pua-override{grid-column:1/-1}.pua-session-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 12px;padding-bottom:12px;border-bottom:0.5px solid var(--dsw-alias-border-l2)}.pua-session-actions span{font-size:12px;color:var(--dsw-alias-label-secondary)}.pua-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}.pua-field-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}.pua-override{display:flex;align-items:center;gap:8px;flex:none}.pua-override small{margin:0}.pua-panel input,.pua-panel select,.pua-panel textarea{box-sizing:border-box;width:100%;min-height:34px;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:7px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit}.pua-panel textarea{resize:vertical}.pua-panel small{display:block;margin-top:5px}.pua-close{min-height:28px;cursor:pointer}.pua-panel input:disabled,.pua-panel textarea:disabled{opacity:.65;cursor:default}.pua-actions{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.pua-panel summary{cursor:pointer;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l2,#ddd)}.pua-error{padding:10px;border:1px solid var(--dsw-alias-state-error-primary,#b33);border-radius:6px;overflow-wrap:anywhere}.pua-panel :focus-visible,.pua-trigger:focus-visible,.pua-close:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#527dcc);outline-offset:2px}.pua-panel details>label{display:block;margin:12px 0}.pua-panel details>label>input,.pua-panel details>label>textarea{margin-top:6px}`;

export async function apply(ctx: ClientContext): Promise<() => void> {
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  const remote = ctx.get('remote.puaConfig') as PuaRemoteApi | undefined;
  if (!remote) { unmount(); throw new Error('PUA 配置连接未就绪。'); }
  ctx.effect(() => { const style = document.createElement('style'); style.textContent = CSS + ACTIVITY_CSS; document.head.append(style); return () => style.remove(); });
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({ name: 'settings.plugin.item', key: 'michengai-pua' }, () => h(PuaSettingsCard, { remote })));
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({ name: 'conversation.input.left', id: 'michengai-pua', order: 10 }, props => props.sessionId ? h(ComposerButton, { key: props.sessionId, remote, sessionId: props.sessionId }) : null));
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'michengai-pua', order: -40 }, props => props.session ? h(ActivityCard, { key: props.session.sessionId, remote, sessionId: props.session.sessionId }) : null));
  return unmount;
}
