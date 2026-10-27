import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Menu, Modal, Switch } from '@deepseek-ai/dsh-client-ui-primitives';
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import { CONFIG_DEFAULTS, CONFIG_KEYS, CONFIG_MODES, LANGUAGE_PREFS, configSchema, parsePatch, type Configuration, type ConfigurationPatch, type LanguagePref } from './configuration.js';
import { FLAVORS } from './flavors.js';
import { UI, flavorLabel, hostLocaleOf, resolveUiLang, type UiCopy, type UiLang } from './i18n.js';
import { watchComposerConfiguration } from './client-refresh.js';
import { ActivityCard, ACTIVITY_CSS } from './activity-card.js';
import { IconChevronDown, IconClose, IconGauge, IconGaugeOff } from './icons.js';
import { TYPERT_REMOTE, type ConfigurationSnapshot, type PuaRemoteApi } from './remote-contract.js';

const h = React.createElement;
type Key = keyof Configuration;
interface SlotRenderProps {
  sessionId?: string;
  session?: { sessionId: string };
  view?: 'summary' | 'page';
}
interface ClientContext {
  slots: { inject(name: string, register: () => () => void): () => void;
    register(options: { name: string; id?: string; key?: string; order?: number; label?: string }, render: (props: SlotRenderProps) => React.ReactNode): () => void };
  remote: { $mount(contribution: TypertRemoteContribution): Promise<() => void> };
  get(name: string): unknown;
  effect(callback: () => () => void): void;
  inject?(deps: string[], callback: (scope: { get?(name: string): unknown }) => void | (() => void)): unknown;
}
const BUNDLE_NAME = '@michengai/dsh-pua';
const CLIENT_ROW = 'michengai-pua';
export const inject = ['slots', 'remote'];
import { modeName } from './display.js';
/** 全局常显字段：enabled, language, flavor, mode, subagents；会话面板不显示 language。 */
const GLOBAL_TOP_KEYS: Key[] = ['enabled', 'language', 'flavor', 'mode', 'subagents'];
const SESSION_TOP_KEYS: Key[] = ['enabled', 'flavor', 'mode', 'subagents'];
function choicesFor(lang: UiLang): Partial<Record<Key, readonly { value: string; label: string }[]>> {
  return {
    language: LANGUAGE_PREFS.map(value => ({ value, label: UI[lang].languageChoices[value] })),
    flavor: [{ value: 'auto', label: UI[lang].autoFlavor }, ...FLAVORS.map(item => ({ value: item.id, label: flavorLabel(item.id, lang) }))],
    mode: CONFIG_MODES.map(value => ({ value, label: modeName(value, lang) })),
  };
}
async function unwrap<T>(result: Promise<RemoteResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) throw new Error(response.error.message);
  return response.value;
}
const message = (error: unknown, copy: UiCopy): string => {
  const rules = copy.validation;
  const text = error instanceof Error ? error.message : rules.fallback;
  try {
    const issues = JSON.parse(text) as { path?: string[]; code?: string; maximum?: number; minimum?: number }[];
    if (Array.isArray(issues)) return issues.map(issue => {
      const field = copy.fields[issue.path?.[0] as Key] ?? rules.fieldFallback;
      return field + (issue.code === 'too_big' ? rules.tooBig(issue.maximum ?? 0) : issue.code === 'too_small' ? rules.tooSmall(issue.minimum ?? 0) : rules.invalid);
    }).join(rules.join);
  } catch { /* 普通远程错误保留原文。 */ }
  return text;
};
/** 菜单、选中标记及键盘交互复用宿主公共组件。 */
function PuaSelect({ id, value, options, disabled, onChange }: {
  id: string; value: string; options: readonly { value: string; label: string }[]; disabled: boolean; onChange: (value: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);
  return h(Menu, {
    open: open && !disabled,
    autoFocus: true,
    portal: true,
    dense: true,
    minWidthFromAnchor: true,
    align: 'end',
    listClassName: 'pua-menu-dropdown',
    items: options.map(option => ({ id: option.value, label: option.label })),
    selectedId: value,
    onClose: () => setOpen(false),
    onSelect: next => { setOpen(false); if (next !== value) onChange(next); },
    anchor: h(Button, {
      id,
      type: 'button',
      variant: 'outline',
      size: 'sm',
      role: 'combobox',
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      disabled,
      className: `pua-select-trigger${open ? ' is-open' : ''}`,
      onClick: () => setOpen(!open),
    },
      h('span', { className: 'pua-select-label' }, current?.label ?? value),
      h(IconChevronDown, { className: `pua-select-chevron${open ? ' is-open' : ''}` })),
  });
}

/** 官方 PluginCard 未公开导出；此壳沿用其按钮结构与主题 token，控件复用 primitives。 */
function PuaSettingsCard({ remote, hostLocale }: { remote: PuaRemoteApi; hostLocale: string | undefined }): React.ReactElement {
  const [open, setOpen] = useState(false);
  // 折叠态标题也遵守手动语言覆盖；读取失败时回退宿主语言。
  const [pref, setPref] = useState<LanguagePref>();
  useEffect(() => { let live = true; void remote.getGlobal().then(result => { if (live && result.ok) setPref(result.value.values.language); }).catch(() => {}); return () => { live = false; }; }, [remote]);
  const copy = UI[resolveUiLang(pref, hostLocale)];
  return h('li', { className: 'pua-settings-card', 'data-open': open },
    h('button', { type: 'button', className: 'pua-card-header', 'aria-expanded': open, 'aria-label': copy.cardToggle(open), onClick: () => setOpen(!open) },
      h('span', { className: 'pua-card-text' }, h('span', { className: 'pua-card-name' }, copy.cardTitle), h('span', { className: 'pua-card-description' }, copy.settingsSummary)),
      h(IconChevronDown, { className: 'pua-card-chevron' })),
    h('div', { className: 'pua-card-body', hidden: !open }, h(ConfigurationPanel, { remote, hostLocale })));
}
/** 官方插件页自己画标题；summary 只给一行说明，page 才是带保存的表单。 */
function PuaPluginConfig({ remote, view, hostLocale }: { remote: PuaRemoteApi; view?: 'summary' | 'page' | undefined; hostLocale: string | undefined }): React.ReactNode {
  // 列表摘要跟随宿主语言；打开后的表单遵守手动覆盖。
  return view === 'summary' ? UI[resolveUiLang('auto', hostLocale)].settingsSummary : h(ConfigurationPanel, { remote, hostLocale });
}
/** 两个入口共享字段与校验；会话入口永远不调用全局写入方法。 */
export function ConfigurationPanel({ remote, sessionId, hostLocale, onLoopStarted }: { remote: PuaRemoteApi; sessionId?: string | undefined; hostLocale?: string | undefined; onLoopStarted?: () => void }): React.ReactElement {
  const [snapshot, setSnapshot] = useState<ConfigurationSnapshot>();
  const [draft, setDraft] = useState<Configuration>(CONFIG_DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(() => UI[resolveUiLang(CONFIG_DEFAULTS.language, hostLocale)].panel.statusLoading);
  const [error, setError] = useState('');
  const [task, setTask] = useState('');
  const [loopValues, setLoopValues] = useState<Configuration>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loopOpen, setLoopOpen] = useState(false);
  const live = useRef(true);
  const saving = useRef(false);
  const epoch = useRef(0);
  const global = !sessionId;
  // 会话面板固定遵循全局配置/继承的语言（快照 defaults 或 values 中的语言），只有全局设置页才随当前未保存草稿 draft.language 变动。
  const effectiveLanguage = global ? draft.language : (snapshot?.defaults?.language ?? snapshot?.values.language);
  const lang = resolveUiLang(effectiveLanguage, hostLocale);
  const copy = UI[lang];
  const choices = choicesFor(lang);
  const accept = (value: ConfigurationSnapshot) => { if (live.current) { setSnapshot(value); setDraft(value.values); setDirty(false); setError(''); setStatus(copy.panel.statusSynced); } };
  const refresh = () => {
    const request = ++epoch.current;
    return unwrap(global ? remote.getGlobal() : remote.getSession(sessionId!)).then(value => { if (request === epoch.current) accept(value); }).catch(reason => { if (live.current && request === epoch.current) setError(message(reason, copy)); });
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
    saving.current = true; setBusy(true); setError(''); setStatus(copy.panel.statusSaving);
    try {
      const saved = await unwrap(global ? remote.setGlobal(configSchema.parse(draft), snapshot.revision) : remote.setSession(sessionId!, parsePatch(patch ?? {}), snapshot.revision));
      accept(saved);
      setStatus(!global && patch?.enabled === true && !saved.values.enabled ? copy.panel.statusSavedSession : copy.panel.statusSaved);
    } catch (reason) { setError(message(reason, copy)); setStatus(copy.panel.statusNotSaved); }
    finally { saving.current = false; setBusy(false); }
  }
  function field(key: Key) {
    const overridden = snapshot && Object.hasOwn(snapshot.overrides, key);
    const id = `pua-${sessionId ?? 'global'}-${key}`;
    const value = draft[key];
    const label = global && key === 'enabled' ? copy.allow.label : copy.fields[key];
    const description = global && key === 'enabled' ? copy.allow.description : copy.descriptions[key];
    const update = (next: Configuration[Key]) => { ++epoch.current; setDraft(previous => ({ ...previous, [key]: next })); setDirty(true); };
    const options = choices[key];

    if (key === 'verify') {
      return h('div', { className: 'pua-field pua-field-block', key },
        h('div', { className: 'pua-field-head' },
          h('label', { htmlFor: id, className: 'pua-field-title' }, label),
          !global && overridden && h(Button, { variant: 'ghost', size: 'sm', className: 'pua-override-btn', disabled: busy, 'aria-label': copy.panel.restoreDefaultAria(label), onClick: () => void save({ [key]: null }) }, copy.panel.restoreDefault)),
        description && h('small', { className: 'pua-field-desc' }, description),
        h('textarea', { id, className: 'pua-textarea', value: typeof value === 'number' && Number.isNaN(value) ? '' : value, disabled: busy, rows: 2, maxLength: 8192,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => update(event.target.value),
          onBlur: () => { if (!global && dirty) void save({ [key]: draft[key] }); } }));
    }

    const input = typeof value === 'boolean'
      ? h(Switch, { checked: key === 'offline' ? !value : value, label, disabled: busy,
        onChange: next => { const parsed = key === 'offline' ? !next : next; if (global) update(parsed); else void save({ [key]: parsed }); } })
      : options ? h(PuaSelect, { id, value: String(value), disabled: busy, options,
        onChange: next => { if (global) update(next); else void save({ [key]: next }); } })
      : h(Input, { id, className: 'pua-number-input', value: typeof value === 'number' && Number.isNaN(value) ? '' : value, disabled: busy, type: 'number',
        min: key === 'verificationTimeout' ? 1 : 0, max: key === 'maxIterations' ? 10000 : key === 'verificationTimeout' ? 3600 : 9999, step: 1,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(event.target.value === '' ? NaN : Number(event.target.value)),
        onBlur: () => { if (!global && dirty) void save({ [key]: draft[key] }); } });

    return h('div', { className: 'pua-field', key },
      h('div', { className: 'pua-field-info' },
        h('label', { htmlFor: id, className: 'pua-field-title' }, label),
        description && h('small', { className: 'pua-field-desc' }, description),
        !global && overridden && h('div', { className: 'pua-override-line' },
          h('span', { className: 'pua-override-badge' }, copy.panel.overrideBadge),
          h(Button, { variant: 'ghost', size: 'sm', className: 'pua-override-btn', disabled: busy, 'aria-label': copy.panel.restoreDefaultAria(label), onClick: () => void save({ [key]: null }) }, copy.panel.restoreDefault))),
      h('div', { className: 'pua-field-control' }, input));
  }
  async function loop(start: boolean) {
    if (!sessionId || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { const result = await unwrap(start ? remote.startLoop(sessionId, task, configSchema.parse(loopValues ?? draft)) : remote.cancelLoop(sessionId)); if (start && onLoopStarted) { onLoopStarted(); return; } await refresh(); setStatus(result.text); }
    catch (reason) { setError(message(reason, copy)); }
    finally { saving.current = false; setBusy(false); }
  }
  const topKeys = global ? GLOBAL_TOP_KEYS : SESSION_TOP_KEYS;
  const detailKeys = CONFIG_KEYS.filter(key => !topKeys.includes(key) && (global || key !== 'language'));
  return h('section', { className: global ? 'pua-panel pua-panel-global' : 'pua-panel', 'aria-label': global ? copy.panel.globalAria : copy.panel.sessionAria },
    !global && snapshot && h('div', { className: 'pua-session-actions' },
      h('p', { className: 'pua-muted' }, copy.panel.sessionNote(Object.keys(snapshot.overrides).length)),
      Object.keys(snapshot.overrides).length > 0 && h(Button, { variant: 'outline', size: 'sm', disabled: busy, onClick: () => void save(Object.fromEntries(CONFIG_KEYS.map(key => [key, null]))) }, copy.panel.restoreAll),
      h('span', { role: 'status', 'aria-live': 'polite' }, busy ? copy.panel.statusSaving : dirty ? copy.panel.statusDirty : status === copy.panel.statusSavedSession ? status : '')),
    global && h('p', { className: 'pua-muted' }, global ? copy.panel.globalNote : ''),
    snapshot?.child && h('p', { className: 'pua-muted' }, copy.panel.childNote),
    error && h('div', { role: 'alert', className: 'pua-error' }, error, h(Button, { variant: 'outline', size: 'sm', onClick: () => void refresh(), disabled: busy }, copy.panel.reload)),
    snapshot && h(React.Fragment, null,
      topKeys.map(key => field(key)),
      h('div', { className: 'pua-section' },
        h('button', { type: 'button', className: 'pua-section-toggle', 'aria-expanded': detailsOpen, onClick: () => setDetailsOpen(!detailsOpen) },
          h('span', { className: 'pua-section-title' }, copy.panel.detailsSummary),
          h(IconChevronDown, { className: `pua-section-chevron${detailsOpen ? ' pua-section-chevron-open' : ''}` })),
        detailsOpen && h('div', { className: 'pua-section-body' }, detailKeys.map(field))),
      global && h('div', { className: 'pua-settings-footer' },
        h(Button, { type: 'button', variant: 'outline', disabled: busy || !dirty, onClick: () => { ++epoch.current; accept(snapshot); } }, copy.panel.discard),
        h(Button, { type: 'button', variant: 'primary', disabled: busy || !dirty, onClick: () => void save() }, busy ? copy.panel.saveBusy : copy.panel.save)),
      !global && h('div', { className: 'pua-section' },
        h('button', { type: 'button', className: 'pua-section-toggle', 'aria-expanded': loopOpen, onClick: () => { if (!loopOpen && !loopValues) setLoopValues({ ...draft }); setLoopOpen(!loopOpen); } },
          h('span', { className: 'pua-section-title' }, copy.panel.loop.summary),
          h(IconChevronDown, { className: `pua-section-chevron${loopOpen ? ' pua-section-chevron-open' : ''}` })),
        loopOpen && h('div', { className: 'pua-section-body pua-loop-form' },
          h('p', { className: 'pua-muted' }, copy.panel.loop.note),
          h('label', { className: 'pua-loop-label' }, h('span', null, copy.panel.loop.task), h('textarea', { className: 'pua-textarea', value: task, rows: 2, maxLength: 4096, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setTask(event.target.value) })),
          h('label', { className: 'pua-loop-label' }, h('span', null, copy.panel.loop.verify), h('textarea', { className: 'pua-textarea', value: (loopValues ?? draft).verify, rows: 2, maxLength: 8192, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setLoopValues({ ...(loopValues ?? draft), verify: event.target.value }) })),
          h('div', { className: 'pua-field' },
            h('div', { className: 'pua-field-info' }, h('span', { className: 'pua-field-title' }, copy.panel.loop.iterations)),
            h(Input, { type: 'number', className: 'pua-number-input', min: 0, max: 10000, value: (loopValues ?? draft).maxIterations, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setLoopValues({ ...(loopValues ?? draft), maxIterations: Number(event.target.value) }) })),
          h('div', { className: 'pua-field' },
            h('div', { className: 'pua-field-info' }, h('span', { className: 'pua-field-title' }, copy.panel.loop.timeout)),
            h(Input, { type: 'number', className: 'pua-number-input', min: 1, max: 3600, value: (loopValues ?? draft).verificationTimeout, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setLoopValues({ ...(loopValues ?? draft), verificationTimeout: Number(event.target.value) }) })),
          h('div', { className: 'pua-actions' }, h(Button, { variant: 'primary', disabled: busy || !task.trim(), onClick: () => void loop(true) }, copy.panel.loop.start), h(Button, { variant: 'outline', disabled: busy, onClick: () => void loop(false) }, copy.panel.loop.cancel))))));
}

function ComposerButton({ remote, sessionId, hostLocale }: { remote: PuaRemoteApi; sessionId: string; hostLocale?: string | undefined }): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [readError, setReadError] = useState('');
  const [snapshot, setSnapshot] = useState<ConfigurationSnapshot>();
  const copy = UI[resolveUiLang(snapshot?.values.language, hostLocale)];
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const watcher = watchComposerConfiguration(remote, sessionId, enabled => {
      setGlobalEnabled(enabled);
      if (!enabled) setOpen(false);
    }, setSnapshot, setReadError, copy.composer.readError);
    window.addEventListener('focus', watcher.refresh);
    return () => { watcher.dispose(); window.removeEventListener('focus', watcher.refresh); };
  }, [remote, sessionId, open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const disabled = snapshot?.values.enabled === false;
  if (!globalEnabled) return null;
  return h('div', { className: 'pua-composer' },
    h(Button as any, { ref: trigger, variant: 'ghost', size: 'sm', className: 'pua-trigger', disabled: !snapshot || !!readError, 'aria-busy': !snapshot, 'data-disabled': disabled, 'data-on': snapshot?.values.enabled === true, 'aria-label': !snapshot ? copy.composer.readingAria : disabled ? copy.composer.offAria : copy.composer.onAria, 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: () => setOpen(true), title: readError || (!snapshot ? copy.composer.readingTitle : disabled ? copy.composer.offTitle : copy.composer.onTitle), icon: h('span', { className: 'pua-entry-icon', 'aria-hidden': true }, h(disabled ? IconGaugeOff : IconGauge)) }, 'PUA'),
    h(Modal, { open, onClose: close, title: copy.panel.sessionHeading, closeLabel: copy.composer.close, className: 'pua-session-modal' },
      h(ConfigurationPanel, { key: sessionId, remote, sessionId, hostLocale, onLoopStarted: close })));
}
// 全局页脚与设置表单遵循宿主设计系统，控件复用 primitives 原语。
const CSS = `.pua-session-modal{width:min(540px,100%)!important;max-height:100%!important}.pua-panel{color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.pua-panel.pua-panel-global{max-width:none}.pua-muted{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;margin:0 0 12px}.pua-field{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:0.5px solid var(--dsw-alias-border-l2)}.pua-field-block{display:block}.pua-field-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}.pua-field-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.pua-field-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}.pua-field-desc{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);margin:0}.pua-field-control{display:flex;align-items:center;justify-content:flex-end;flex:none}.pua-override-line{display:inline-flex;align-items:center;gap:6px;margin-top:2px}.pua-override-badge{font-size:11px;color:var(--dsw-alias-label-tertiary)}.pua-override-btn{font-size:11px;color:var(--dsw-alias-link,#4176e6);padding:0 4px;height:20px;border:none;background:transparent;cursor:pointer}.pua-override-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-link,#4176e6) 10%,transparent)}.pua-number-input{width:140px;flex:none}.pua-textarea{box-sizing:border-box;width:100%;min-height:56px;padding:8px 10px;margin-top:6px;border:1px solid var(--dsw-alias-input-border,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-input-bg,var(--dsw-alias-bg-layer-2));color:inherit;font:inherit;resize:vertical}.pua-textarea:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#4176e6);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 20%,transparent)}.pua-textarea:disabled{opacity:.65;cursor:default}.pua-section{border-top:0.5px solid var(--dsw-alias-border-l2)}.pua-section-toggle{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:12px 0;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}.pua-section-toggle:hover{color:var(--dsw-alias-label-dimmed)}.pua-section-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s ease}.pua-section-chevron-open{transform:rotate(180deg)}.pua-section-body{padding-bottom:8px}.pua-settings-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:16px 0 4px;border-top:0.5px solid var(--dsw-alias-border-l2)}.pua-session-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;padding-bottom:12px;border-bottom:0.5px solid var(--dsw-alias-border-l2)}.pua-session-actions .pua-muted{margin:0}.pua-error{padding:10px 12px;margin:8px 0;border:1px solid var(--dsw-alias-state-error-primary);border-radius:var(--dsw-radius-md,8px);color:var(--dsw-alias-state-error-primary);display:flex;align-items:center;justify-content:space-between;gap:10px}.pua-loop-form{padding:8px 0}.pua-loop-label{display:block;margin:10px 0;font-size:13px;color:var(--dsw-alias-label-primary)}.pua-loop-label span{display:block;margin-bottom:4px;font-weight:500}.pua-actions{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.pua-select-trigger{display:inline-flex;align-items:center;justify-content:space-between;gap:8px;max-width:240px;min-width:120px;height:28px;padding:0 10px;font-size:12px;font-weight:normal;color:var(--dsw-alias-label-primary)}.pua-select-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}.pua-select-chevron{flex:none;width:12px;height:12px;color:var(--dsw-alias-label-tertiary);transition:transform 140ms ease}.pua-select-chevron.is-open{transform:rotate(180deg)}.pua-menu-dropdown{max-height:260px;min-width:140px;max-width:min(280px,80vw);overflow-y:auto}.pua-trigger{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-weight:500;padding:0 8px}.pua-trigger:hover:not(:disabled),.pua-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}.pua-trigger[data-on=true]{color:var(--dsw-alias-state-business-primary,#4176e6);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 14%,transparent)}.pua-trigger[data-on=true]:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 22%,transparent)}.pua-trigger[data-disabled=true]{color:var(--dsw-alias-label-tertiary)}.pua-composer{display:inline-flex;order:2;flex:none}.pua-settings-card{list-style:none;border-bottom:0.5px solid var(--dsw-alias-border-l2)}.pua-card-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 0}.pua-card-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.pua-card-name{font-size:14px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}.pua-card-description{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}.pua-card-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s ease}.pua-settings-card[data-open=true] .pua-card-chevron{transform:rotate(180deg)}.pua-card-body{padding-bottom:12px}`;

/** 宿主 `/` 行没有 icon/label；一等命令按 definitionId 换脸。同名贡献会撞车，只能在候选项上覆盖文案。 */
const FACES: Record<string, { icon: unknown; copy: 'pua' | 'cancelLoop' }> = {
  pua: { icon: IconGauge, copy: 'pua' },
  'pua-cancel-loop': { icon: IconClose, copy: 'cancelLoop' },
};
const SLASH_COMMANDS = new Set<string>(Object.keys(FACES));
type Lookup = { get?(name: string): unknown };
/** 可见性与菜单语言同一次读取；语言跟随设置里的 language，不是注册表里的中文字符串。 */
async function slashMenu(remote: PuaRemoteApi | undefined, ctx: Lookup): Promise<{ visible: boolean; lang: UiLang }> {
  let pref: LanguagePref | undefined;
  let visible = true;
  if (typeof remote?.getGlobal === 'function') {
    try {
      const result = await remote.getGlobal();
      if (result.ok) {
        visible = result.value.values.enabled;
        pref = result.value.values.language;
      }
    } catch { /* 读取失败时保持列出，语言跟随宿主。 */ }
  }
  return { visible, lang: resolveUiLang(pref, hostLocaleOf(ctx)) };
}
function decorateSlashFaces(commandUi: unknown, ctx: Lookup, remote: PuaRemoteApi | undefined): () => void {
  const live = commandUi as { candidates?: (...args: unknown[]) => unknown } | undefined;
  const original = live?.candidates;
  if (!live || typeof original !== 'function') return () => {};
  live.candidates = async (...args: unknown[]) => {
    const rows = await original.apply(live, args);
    if (!Array.isArray(rows)) return rows;
    const menu = await slashMenu(remote, ctx);
    const slash = UI[menu.lang].slash;
    return rows.flatMap((row: unknown) => {
      if (!row || typeof row !== 'object' || !('name' in row) || typeof (row as { name: unknown }).name !== 'string') return [row];
      const item = row as { name: string; icon?: unknown; label?: unknown; description?: unknown; hint?: unknown };
      if (!menu.visible && SLASH_COMMANDS.has(item.name)) return [];
      const face = FACES[item.name as keyof typeof FACES];
      if (!face) return [item];
      const text = slash[face.copy];
      return [{
        ...item,
        ...(item.icon === undefined ? { icon: face.icon } : {}),
        label: text.label,
        description: text.description,
        ...(text.hint === undefined ? {} : { hint: text.hint }),
      }];
    });
  };
  return () => { live.candidates = original; };
}

export async function apply(ctx: ClientContext): Promise<() => void> {
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
  const remote = ctx.get('remote.puaConfig') as PuaRemoteApi | undefined;
  if (!remote) { unmount(); throw new Error('PUA 配置连接未就绪。'); }
  const hostLocale = hostLocaleOf(ctx);
  if (typeof ctx.inject === 'function') ctx.inject(['commandUi'], scope => decorateSlashFaces(scope.get?.('commandUi'), ctx, remote));
  else ctx.effect(() => decorateSlashFaces(ctx.get('commandUi'), ctx, remote));
  ctx.effect(() => { const style = document.createElement('style'); style.textContent = CSS + ACTIVITY_CSS; document.head.append(style); return () => style.remove(); });
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({ name: 'settings.plugin.item', key: CLIENT_ROW }, () => h(PuaSettingsCard, { remote, hostLocale })));
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: BUNDLE_NAME }, props => h(PuaPluginConfig, { remote, view: props.view, hostLocale })));
  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({ name: 'plugins.row.config', key: `${BUNDLE_NAME}#${CLIENT_ROW}` }, props => h(PuaPluginConfig, { remote, view: props.view, hostLocale })));
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({ name: 'conversation.input.left', id: CLIENT_ROW, order: 10 }, props => props.sessionId ? h(ComposerButton, { key: props.sessionId, remote, sessionId: props.sessionId, hostLocale }) : null));
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: CLIENT_ROW, order: -40 }, props => props.session ? h(ActivityCard, { key: props.session.sessionId, remote, sessionId: props.session.sessionId, hostLocale }) : null));
  return unmount;
}
