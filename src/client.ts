import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Menu, Modal, Switch } from '@deepseek-ai/dsh-client-ui-primitives';
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import { CONFIG_DEFAULTS, CONFIG_KEYS, CONFIG_MODES, LANGUAGE_PREFS, configSchema, parsePatch, type Configuration, type ConfigurationPatch, type LanguagePref } from './configuration.js';
import { FLAVORS } from './flavors.js';
import { UI, flavorLabel, hostLocaleOf, resolveUiLang, type UiCopy, type UiLang } from './i18n.js';
import { watchComposerConfiguration } from './client-refresh.js';
import { ActivityCard, ACTIVITY_CSS } from './activity-card.js';
import { IconChevronDown, IconClose, IconGauge, IconGaugeOff, IconRefresh } from './icons.js';
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
const REMOTE_ERRORS: Record<UiLang, Record<string, string>> = {
  zh: {
    '会话尚未加载或已关闭，请重新打开会话后重试。': '会话尚未加载或已关闭，请重新打开会话后重试。',
    'PUA 设置服务尚未就绪。': 'PUA 设置服务尚未就绪。',
    '宿主未提供全局设置，仅支持会话命令配置。': '宿主未提供全局设置，仅支持会话命令配置。',
    '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。': '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。',
    '请输入 1–4096 字符的任务。': '请输入 1–4096 字符的任务。',
    'PUA 命令未注册，请重载后端。': 'PUA 命令未注册，请重载后端。',
    'Loop 已提交。': 'Loop 已提交。',
    'Loop 已取消。': 'Loop 已取消。',
  },
  en: {
    '会话尚未加载或已关闭，请重新打开会话后重试。': 'Session is not loaded or has closed. Please reopen the session and retry.',
    'PUA 设置服务尚未就绪。': 'PUA settings service is not ready.',
    '宿主未提供全局设置，仅支持会话命令配置。': 'Host does not provide global settings; only session commands are supported.',
    '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。': 'Allow PUA is disabled; this session cannot be enabled. Turn it on in plugin settings first.',
    '请输入 1–4096 字符的任务。': 'Please enter a task between 1 and 4096 characters.',
    'PUA 命令未注册，请重载后端。': 'PUA command is not registered. Please reload the backend.',
    'Loop 已提交。': 'Loop submitted.',
    'Loop 已取消。': 'Loop canceled.',
  },
  ja: {
    '会话尚未加载或已关闭，请重新打开会话后重试。': 'セッションが読み込まれていないか終了しています。再度開いてお試しください。',
    'PUA 设置服务尚未就绪。': 'PUA 設定サービスはまだ準備ができていません。',
    '宿主未提供全局设置，仅支持会话命令配置。': 'ホストがグローバル設定を提供していません。セッションコマンドのみサポートされます。',
    '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。': '「PUA の使用を許可」が無効です。先にプラグイン設定で有効にしてください。',
    '请输入 1–4096 字符的任务。': '1〜4096 文字でタスクを入力してください。',
    'PUA 命令未注册，请重载后端。': 'PUA コマンドが登録されていません。バックエンドを再読込してください。',
    'Loop 已提交。': 'Loop を送信しました。',
    'Loop 已取消。': 'Loop をキャンセルしました。',
  },
  es: {
    '会话尚未加载或已关闭，请重新打开会话后重试。': 'La sesión no se ha cargado o está cerrada. Vuelve a abrirla y reintenta.',
    'PUA 设置服务尚未就绪。': 'El servicio de configuración de PUA no está listo.',
    '宿主未提供全局设置，仅支持会话命令配置。': 'El host no proporciona ajustes globales; solo se admiten comandos de sesión.',
    '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。': '«Permitir PUA» está desactivado; no se puede habilitar esta sesión. Actívalo antes en los ajustes.',
    '请输入 1–4096 字符的任务。': 'Por favor, introduce una tarea de 1 a 4096 caracteres.',
    'PUA 命令未注册，请重载后端。': 'El comando PUA no está registrado. Recarga el backend.',
    'Loop 已提交。': 'Loop enviado.',
    'Loop 已取消。': 'Loop cancelado.',
  },
  fr: {
    '会话尚未加载或已关闭，请重新打开会话后重试。': 'La session n\'est pas chargée ou est fermée. Rouvrez-la et réessayez.',
    'PUA 设置服务尚未就绪。': 'Le service de paramètres PUA n\'est pas encore prêt.',
    '宿主未提供全局设置，仅支持会话命令配置。': 'L\'hôte ne fournit pas de paramètres globaux ; seules les commandes de session sont prises en charge.',
    '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。': '« Autoriser PUA » est désactivé ; activez-le d\'abord dans les paramètres du plugin.',
    '请输入 1–4096 字符的任务。': 'Veuillez saisir une tâche comprise entre 1 et 4096 caractères.',
    'PUA 命令未注册，请重载后端。': 'La commande PUA n\'est pas enregistrée. Rechargez le backend.',
    'Loop 已提交。': 'Loop soumis.',
    'Loop 已取消。': 'Loop annulé.',
  },
  de: {
    '会话尚未加载或已关闭，请重新打开会话后重试。': 'Sitzung nicht geladen oder geschlossen. Bitte erneut öffnen und wiederholen.',
    'PUA 设置服务尚未就绪。': 'Der PUA-Einstellungsdienst ist noch nicht bereit.',
    '宿主未提供全局设置，仅支持会话命令配置。': 'Der Host bietet keine globalen Einstellungen; nur Sitzungsbefehle werden unterstützt.',
    '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。': '„PUA zulassen“ ist deaktiviert; bitte zuerst in den Plugin-Einstellungen aktivieren.',
    '请输入 1–4096 字符的任务。': 'Bitte geben Sie eine Aufgabe mit 1 bis 4096 Zeichen ein.',
    'PUA 命令未注册，请重载后端。': 'Der PUA-Befehl ist nicht registriert. Bitte Backend neu laden.',
    'Loop 已提交。': 'Loop übermittelt.',
    'Loop 已取消。': 'Loop abgebrochen.',
  },
  ru: {
    '会话尚未加载或已关闭，请重新打开会话后重试。': 'Сессия не загружена или закрыта. Откройте сессию заново и повторите попытку.',
    'PUA 设置服务尚未就绪。': 'Служба настроек PUA ещё не готова.',
    '宿主未提供全局设置，仅支持会话命令配置。': 'Хост не предоставляет глобальные настройки; поддерживаются только команды сессии.',
    '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。': '«Разрешить PUA» отключено; эта сессия не может быть включена. Сначала включите в настройках плагина.',
    '请输入 1–4096 字符的任务。': 'Пожалуйста, введите задачу от 1 до 4096 символов.',
    'PUA 命令未注册，请重载后端。': 'Команда PUA не зарегистрирована. Перезагрузите бэкенд.',
    'Loop 已提交。': 'Loop отправлен.',
    'Loop 已取消。': 'Loop отменён.',
  },
  pt: {
    '会话尚未加载或已关闭，请重新打开会话后重试。': 'A sessão não foi carregada ou foi fechada. Reabra a sessão e tente novamente.',
    'PUA 设置服务尚未就绪。': 'O serviço de configurações do PUA não está pronto.',
    '宿主未提供全局设置，仅支持会话命令配置。': 'O host não fornece configurações globais; apenas comandos de sessão são suportados.',
    '已关闭「允许使用 PUA」，当前会话不能开启。请先在插件设置中打开。': '«Permitir PUA» está desativado; ative primeiro nas configurações do plugin.',
    '请输入 1–4096 字符的任务。': 'Por favor, insira uma tarefa entre 1 e 4096 caracteres.',
    'PUA 命令未注册，请重载后端。': 'O comando PUA não está registrado. Recarregue o backend.',
    'Loop 已提交。': 'Loop enviado.',
    'Loop 已取消。': 'Loop cancelado.',
  },
};

const message = (error: unknown, copy: UiCopy, lang: UiLang = 'zh'): string => {
  const rules = copy.validation;
  const text = error instanceof Error ? error.message : rules.fallback;
  try {
    const issues = JSON.parse(text) as { path?: string[]; code?: string; maximum?: number; minimum?: number }[];
    if (Array.isArray(issues)) return issues.map(issue => {
      const field = copy.fields[issue.path?.[0] as Key] ?? rules.fieldFallback;
      return field + (issue.code === 'too_big' ? rules.tooBig(issue.maximum ?? 0) : issue.code === 'too_small' ? rules.tooSmall(issue.minimum ?? 0) : rules.invalid);
    }).join(rules.join);
  } catch { /* 普通远程错误查找本地化映射。 */ }
  return REMOTE_ERRORS[lang]?.[text] ?? text;
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
    return unwrap(global ? remote.getGlobal() : remote.getSession(sessionId!)).then(value => { if (request === epoch.current) accept(value); }).catch(reason => { if (live.current && request === epoch.current) setError(message(reason, copy, lang)); });
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
    } catch (reason) { setError(message(reason, copy, lang)); setStatus(copy.panel.statusNotSaved); }
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
    try { const result = await unwrap(start ? remote.startLoop(sessionId, task, configSchema.parse(loopValues ?? draft)) : remote.cancelLoop(sessionId)); if (start && onLoopStarted) { onLoopStarted(); return; } await refresh(); setStatus(REMOTE_ERRORS[lang]?.[result.text] ?? result.text); }
    catch (reason) { setError(message(reason, copy, lang)); }
    finally { saving.current = false; setBusy(false); }
  }
  const topKeys = global ? GLOBAL_TOP_KEYS : SESSION_TOP_KEYS;
  const detailKeys = CONFIG_KEYS.filter(key => !topKeys.includes(key) && (global || key !== 'language'));
  return h('section', { className: global ? 'pua-panel pua-panel-global' : 'pua-panel', 'aria-label': global ? copy.panel.globalAria : copy.panel.sessionAria },
    !global && snapshot && h('div', { className: 'pua-session-actions' },
      h('div', { className: 'pua-session-note-wrap' },
        h('p', { className: 'pua-muted' }, copy.panel.sessionNote(Object.keys(snapshot.overrides).length)),
        h('span', { role: 'status', 'aria-live': 'polite' }, busy ? copy.panel.statusSaving : dirty ? copy.panel.statusDirty : status === copy.panel.statusSavedSession ? status : '')),
      Object.keys(snapshot.overrides).length > 0 && h(Button, {
        variant: 'ghost',
        size: 'sm',
        className: 'pua-restore-all-btn',
        disabled: busy,
        icon: h(IconRefresh, { size: 16 }),
        onClick: () => void save(Object.fromEntries(CONFIG_KEYS.map(key => [key, null])))
      }, copy.panel.restoreAll)),
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
    h(Modal, { open, onClose: close, title: copy.panel.sessionHeading, closeLabel: copy.composer.close, className: 'pua-session-modal', contentClassName: 'pua-session-modal-content' },
      h(ConfigurationPanel, { key: sessionId, remote, sessionId, hostLocale, onLoopStarted: close })));
}
// 全局页脚与设置表单遵循宿主设计系统，控件复用 primitives 原语。
const CSS = `.pua-session-modal{width:min(540px,100%)!important;max-height:100%!important;display:flex!important;flex-direction:column!important}.pua-session-modal-content,.pua-session-modal>div:first-child{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important}.pua-session-modal-content>div:last-of-type,.pua-session-modal>div:first-child>div:last-of-type{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important}.pua-session-modal-content>div:has(>.pua-panel),.pua-session-modal>div:first-child>div:has(>.pua-panel){display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important}.pua-panel{color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.pua-panel.pua-panel-global{max-width:none}.pua-muted{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;margin:0 0 12px}.pua-field{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:0.5px solid var(--dsw-alias-border-l2)}.pua-field-block{display:block}.pua-field-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}.pua-field-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.pua-field-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}.pua-field-desc{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);margin:0}.pua-field-control{display:flex;align-items:center;justify-content:flex-end;flex:none}.pua-override-line{display:inline-flex;align-items:center;gap:6px;margin-top:2px}.pua-override-badge{font-size:11px;color:var(--dsw-alias-label-tertiary)}.pua-override-btn{font-size:11px;color:var(--dsw-alias-link,#4176e6);padding:0 4px;height:20px;border:none;background:transparent;cursor:pointer}.pua-override-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-link,#4176e6) 10%,transparent)}.pua-number-input{width:140px;flex:none}.pua-textarea{box-sizing:border-box;width:100%;min-height:56px;padding:8px 10px;margin-top:6px;border:1px solid var(--dsw-alias-input-border,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-input-bg,var(--dsw-alias-bg-layer-2));color:inherit;font:inherit;resize:vertical}.pua-textarea:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#4176e6);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 20%,transparent)}.pua-textarea:disabled{opacity:.65;cursor:default}.pua-section{border-top:0.5px solid var(--dsw-alias-border-l2)}.pua-section-toggle{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:12px 0;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}.pua-section-toggle:hover{color:var(--dsw-alias-label-dimmed)}.pua-section-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s ease}.pua-section-chevron-open{transform:rotate(180deg)}.pua-section-body{padding-bottom:8px}.pua-settings-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:16px 0 4px;border-top:0.5px solid var(--dsw-alias-border-l2)}.pua-session-actions{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 12px;padding-bottom:12px;border-bottom:0.5px solid var(--dsw-alias-border-l2)}.pua-session-note-wrap{flex:1;min-width:0}.pua-session-actions .pua-muted{margin:0;font-size:12px;line-height:1.5}.pua-restore-all-btn{flex:none;white-space:nowrap}.pua-error{padding:10px 12px;margin:8px 0;border:1px solid var(--dsw-alias-state-error-primary);border-radius:var(--dsw-radius-md,8px);color:var(--dsw-alias-state-error-primary);display:flex;align-items:center;justify-content:space-between;gap:10px}.pua-loop-form{padding:8px 0}.pua-loop-label{display:block;margin:10px 0;font-size:13px;color:var(--dsw-alias-label-primary)}.pua-loop-label span{display:block;margin-bottom:4px;font-weight:500}.pua-actions{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.pua-select-label{max-width:min(200px,35vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pua-select-chevron{flex:none;width:12px;height:12px;color:var(--dsw-alias-label-tertiary);transition:transform 140ms ease}.pua-select-chevron.is-open{transform:rotate(180deg)}.pua-menu-dropdown{max-height:260px;min-width:140px;max-width:min(280px,80vw);overflow-y:auto}.pua-trigger{color:var(--dsw-alias-label-secondary);font-weight:500}.pua-trigger[data-on=true]{color:var(--dsw-alias-state-business-primary,#4176e6);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 14%,transparent)}.pua-trigger[data-on=true]:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 22%,transparent)}.pua-trigger[data-disabled=true]{color:var(--dsw-alias-label-tertiary)}.pua-composer{display:inline-flex;order:2;flex:none}.pua-settings-card{list-style:none;border-bottom:0.5px solid var(--dsw-alias-border-l2)}.pua-card-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 0}.pua-card-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.pua-card-name{font-size:14px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}.pua-card-description{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}.pua-card-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s ease}.pua-settings-card[data-open=true] .pua-card-chevron{transform:rotate(180deg)}.pua-card-body{padding-bottom:12px}`;

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
