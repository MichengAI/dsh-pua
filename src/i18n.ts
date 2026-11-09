import { FLAVORS } from './flavors.js';
import type { Configuration, LanguagePref } from './configuration.js';

/** 操作者可见界面文案的语言；模型侧 prompt 与服务端回复不在本地化范围。 */
export type UiLang = 'zh' | 'en' | 'ja' | 'es' | 'fr' | 'de' | 'ru' | 'pt';

type ConfigKey = keyof Configuration;

/** 手动覆盖时才与宿主 locale 解耦；auto 表示跟随宿主。 */
export function resolveUiLang(pref: LanguagePref | undefined, hostLocale: string | undefined): UiLang {
  if (pref && pref !== 'auto') {
    if (pref === 'en') return 'en';
    if (pref === 'zh-CN') return 'zh';
    if (pref === 'ru') return 'ru';
    if (pref === 'ja') return 'ja';
    if (pref === 'es') return 'es';
    if (pref === 'fr') return 'fr';
    if (pref === 'de') return 'de';
    if (pref === 'pt') return 'pt';
  }
  if (typeof hostLocale === 'string') {
    const tag = hostLocale.replace(/_/g, '-').toLowerCase();
    if (/^zh\b/.test(tag)) return 'zh';
    if (/^ja\b/.test(tag)) return 'ja';
    if (/^es\b/.test(tag)) return 'es';
    if (/^fr\b/.test(tag)) return 'fr';
    if (/^de\b/.test(tag)) return 'de';
    if (/^ru\b/.test(tag)) return 'ru';
    if (/^pt\b/.test(tag)) return 'pt';
    if (/^en\b/.test(tag)) return 'en';
    return 'en';
  }
  return 'zh';
}

type Lookup = { get?(name: string): unknown };

/** 读取宿主 locale 服务当前 active 值；支持 snapshot.active 及 get() 方法，缺失或形态不符时返回 undefined。 */
export function hostLocaleOf(lookup: Lookup): string | undefined {
  const locale = lookup.get?.('locale') as { snapshot?: { active?: unknown }; get?(): unknown } | undefined;
  const active = locale?.snapshot?.active ?? (typeof locale?.get === 'function' ? locale.get() : undefined);
  return typeof active === 'string' ? active : undefined;
}

const EN_FLAVOR_LABELS: Record<string, string> = {
  alibaba: 'Alibaba', bytedance: 'ByteDance', huawei: 'Huawei', tencent: 'Tencent', baidu: 'Baidu',
  pinduoduo: 'Pinduoduo', meituan: 'Meituan', jd: 'JD', xiaomi: 'Xiaomi', netflix: 'Netflix',
  tesla: 'Tesla (Musk)', apple: 'Apple (Jobs)', amazon: 'Amazon', microsoft: 'Microsoft', ding: 'DingTalk',
};

const RU_FLAVOR_LABELS: Record<string, string> = {
  alibaba: 'Alibaba', bytedance: 'ByteDance', huawei: 'Huawei', tencent: 'Tencent', baidu: 'Baidu',
  pinduoduo: 'Pinduoduo', meituan: 'Meituan', jd: 'JD', xiaomi: 'Xiaomi', netflix: 'Netflix',
  tesla: 'Tesla (Маск)', apple: 'Apple (Джобс)', amazon: 'Amazon', microsoft: 'Microsoft', ding: 'DingTalk',
};

const JA_FLAVOR_LABELS: Record<string, string> = {
  alibaba: 'アリババ', bytedance: 'ByteDance', huawei: 'ファーウェイ', tencent: 'テンセント', baidu: '百度',
  pinduoduo: 'Pinduoduo', meituan: '美団', jd: 'JD', xiaomi: 'Xiaomi', netflix: 'Netflix',
  tesla: 'テスラ (マスク)', apple: 'Apple (ジョブズ)', amazon: 'Amazon', microsoft: 'マイクロソフト', ding: 'DingTalk',
};

/** 风味显示名；未知 id 原样返回。 */
export function flavorLabel(id: string, lang: UiLang): string {
  if (lang === 'zh') return FLAVORS.find(item => item.id === id)?.label ?? id;
  if (lang === 'ru') return RU_FLAVOR_LABELS[id] ?? id;
  if (lang === 'ja') return JA_FLAVOR_LABELS[id] ?? id;
  return EN_FLAVOR_LABELS[id] ?? id;
}

export interface LoopCopy {
  summary: string; note: string; task: string; verify: string; iterations: string; timeout: string; start: string; cancel: string;
}

export interface PanelCopy {
  globalAria: string; sessionAria: string; sessionHeading: string;
  globalNote: string; sessionNote: (overridden: number) => string;
  restoreAll: string; childNote: string; reload: string;
  statusLoading: string; statusSynced: string; statusSaving: string; statusSaved: string;
  statusSavedSession: string; statusNotSaved: string; statusDirty: string;
  overrideBadge: string; restoreDefault: string; restoreDefaultAria: (label: string) => string;
  detailsSummary: string; discard: string; save: string; saveBusy: string;
  loop: LoopCopy;
}

export interface ComposerCopy {
  readingAria: string; offAria: string; onAria: string;
  readingTitle: string; offTitle: string; onTitle: string;
  dialogAria: string; closePanel: string; close: string; readError: string;
}

/** 斜杠菜单行。宿主命令注册表只接受普通字符串，菜单文案在每次生成候选项时按界面语言覆盖。 */
export interface SlashCommandCopy {
  label: string;
  description: string;
  hint?: string;
}

export interface UiCopy {
  settingsSummary: string;
  cardTitle: string;
  cardToggle: (open: boolean) => string;
  /** 全局开关只控制命令和聊天入口，不代表会话已注入。 */
  allow: { label: string; description: string };
  fields: Record<ConfigKey, string>;
  languageChoices: Record<LanguagePref, string>;
  autoFlavor: string;
  descriptions: Partial<Record<ConfigKey, string>>;
  validation: {
    fallback: string; invalid: string;
    tooBig: (max: number) => string; tooSmall: (min: number) => string;
    join: string; fieldFallback: string;
  };
  panel: PanelCopy;
  composer: ComposerCopy;
  slash: { pua: SlashCommandCopy & { hint: string }; cancelLoop: SlashCommandCopy };
}

export const UI: Record<UiLang, UiCopy> = {
  zh: {
    settingsSummary: '命令与聊天入口、角色风味和子代理策略。',
    cardTitle: 'PUA 配置',
    cardToggle: open => `${open ? '收起' : '展开'}：PUA 配置`,
    allow: {
      label: '允许使用 PUA',
      description: '开启后显示 /pua 和聊天入口。关闭后这两处隐藏，当前会话也不能打开。不会自动注入。',
    },
    fields: {
      enabled: '开启 PUA', flavor: '风味', mode: '角色模式', subagents: '对子代理启用 PUA',
      terminalReview: '终端异常核验提醒', failureCandidates: '失败升级候选提示', qualityTriggers: '质量纠偏提示',
      integrityGuard: '防作弊门',
      offline: '反馈提醒', feedbackFrequency: '反馈提醒频率', maxIterations: 'Loop 轮次上限', verify: '默认验收命令', verificationTimeout: '验收超时（秒）',
      language: '界面语言',
    },
    languageChoices: {
      auto: '自动（跟随宿主）', 'zh-CN': '中文', en: 'English', ja: '日本語',
      es: 'Español', fr: 'Français', de: 'Deutsch', ru: 'Русский', pt: 'Português',
    },
    autoFlavor: '自动选味',
    descriptions: {
      subagents: '默认关闭，避免干扰专家插件。开启后继承父会话生效配置，不继承循环或失败计数。',
      enabled: '默认关闭。用 /pua 或聊天入口打开后，只注入当前会话。',
      maxIterations: '0 表示不限轮次。保存配置不会启动 Loop。',
      verify: '留空使用模型报告，不代表独立验收通过。命令在会话工作目录执行，启动时可修改。',
      verificationTimeout: '已启动的 Loop 保持启动时确认的参数。',
      feedbackFrequency: '每多少次有 PUA 可见输出的交付提醒一次，0 关闭。插件不上传反馈。',
      language: 'auto 跟随宿主界面语言。',
      integrityGuard: '默认关闭。开启后拦截隐藏基准答案，变更测试、评分或 CI 资产时向模型注入提醒。',
    },
    validation: {
      fallback: '保存失败，请重试。', invalid: '的值无效，请检查输入',
      tooBig: max => '不能超过 ' + max, tooSmall: min => '不能小于 ' + min,
      join: '；', fieldFallback: '配置',
    },
    panel: {
      globalAria: 'PUA 全局配置', sessionAria: 'PUA 会话配置', sessionHeading: '当前会话 PUA',
      globalNote: '控制 /pua 和聊天入口是否可用。已经在会话里单独打开的开关保持不变。',
      sessionNote: n => `仅影响当前会话 · 已自定义 ${n} 项。会话默认关闭；全局开关只决定命令和入口是否可用。`,
      restoreAll: '恢复全部继承',
      childNote: '子代理的未覆盖项继承父会话生效值；父会话关闭或不允许对子代理启用时，本会话不能强制开启。',
      reload: '重新读取配置',
      statusLoading: '正在读取配置…', statusSynced: '配置已同步', statusSaving: '正在保存…',
      statusSaved: '已保存 · 从下一模型步骤生效',
      statusSavedSession: '已保存；实际开关受父会话与子代理策略限制，请以下方状态为准',
      statusNotSaved: '未保存', statusDirty: '有未保存的修改',
      overrideBadge: '已自定义', restoreDefault: '恢复默认', restoreDefaultAria: label => `恢复${label}默认值`,
      detailsSummary: '提醒与 Loop 默认参数', discard: '放弃修改', save: '保存', saveBusy: '保存中…',
      loop: {
        summary: '启动或取消 Loop', note: '下方参数只用于本次启动，不修改默认设置。',
        task: '任务', verify: '本次验收命令（留空使用模型报告）',
        iterations: '本次轮次上限（0 不限）', timeout: '本次验收超时（秒）',
        start: '启动 Loop', cancel: '取消当前 Loop',
      },
    },
    composer: {
      readingAria: 'PUA（正在读取会话配置）', offAria: 'PUA（当前会话已关闭）', onAria: 'PUA（当前会话已开启）',
      readingTitle: '正在读取会话配置', offTitle: 'PUA 已关闭，点击配置', onTitle: 'PUA 已开启，点击配置',
      dialogAria: '当前会话 PUA 配置', closePanel: '关闭配置面板', close: '关闭',
      readError: '无法读取全局配置，请检查连接或打开插件配置页重试。',
    },
    slash: {
      pua: {
        label: '催办',
        description: '开启 PUA 任务模式、切换风味、换方法或核查验收证据',
        hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|任务描述]',
      },
      cancelLoop: { label: '取消循环', description: '取消当前会话 PUA Loop，不中断普通模型任务' },
    },
  },
  en: {
    settingsSummary: 'Command and chat entry, persona flavor, and subagent policy.',
    cardTitle: 'PUA settings',
    cardToggle: open => `${open ? 'Collapse' : 'Expand'}: PUA settings`,
    allow: {
      label: 'Allow PUA',
      description: 'Shows /pua and the chat entry. When off, both are hidden and this conversation cannot be turned on. It does not inject by itself.',
    },
    fields: {
      enabled: 'Enable PUA', flavor: 'Persona flavor', mode: 'Role mode', subagents: 'Enable for subagents',
      terminalReview: 'Terminal anomaly review reminders', failureCandidates: 'Failure escalation hints', qualityTriggers: 'Quality correction prompts',
      integrityGuard: 'Integrity guard',
      offline: 'Feedback reminders', feedbackFrequency: 'Feedback reminder frequency', maxIterations: 'Loop iteration cap', verify: 'Default verify command', verificationTimeout: 'Verify timeout (s)',
      language: 'UI language',
    },
    languageChoices: {
      auto: 'Auto (follow host)', 'zh-CN': 'Chinese', en: 'English', ja: 'Japanese',
      es: 'Spanish', fr: 'French', de: 'German', ru: 'Russian', pt: 'Portuguese',
    },
    autoFlavor: 'Auto',
    descriptions: {
      subagents: "Off by default to avoid interfering with expert plugins. When enabled, subagents inherit the parent session\'s effective config, not loops or failure counts.",
      enabled: 'Off by default. /pua or the chat entry turns injection on for this conversation only.',
      maxIterations: '0 means unlimited. Saving settings does not start a loop.',
      verify: 'Leave empty to use the model report, which is not an independent check. The command runs in the session working directory and can be changed at loop start.',
      verificationTimeout: 'Running loops keep the parameters confirmed at start.',
      feedbackFrequency: 'Remind once every N delivered outputs with visible PUA activity; 0 disables. Nothing is uploaded.',
      language: 'auto follows the host UI language.',
      integrityGuard: 'Off by default. When on, deny hidden benchmark answers and remind when edits touch test, scoring, or CI assets.',
    },
    validation: {
      fallback: 'Save failed, please retry.', invalid: ' has an invalid value',
      tooBig: max => ' cannot exceed ' + max, tooSmall: min => ' cannot be less than ' + min,
      join: '; ', fieldFallback: 'Settings',
    },
    panel: {
      globalAria: 'PUA global settings', sessionAria: 'PUA session settings', sessionHeading: 'PUA for this session',
      globalNote: 'Controls whether /pua and the chat entry are available. Switches already turned on in a conversation stay on.',
      sessionNote: n => `Affects this conversation only · ${n} overridden. Conversations start off; the global switch only controls the command and chat entry.`,
      restoreAll: 'Restore all inheritance',
      childNote: 'A subagent inherits the parent session for keys it has not overridden; when the parent session is off or disallows subagents, this session cannot force enablement.',
      reload: 'Reload settings',
      statusLoading: 'Loading settings…', statusSynced: 'Settings synced', statusSaving: 'Saving…',
      statusSaved: 'Saved · takes effect from the next model step',
      statusSavedSession: 'Saved; the actual switch is constrained by the parent session and subagent policy — see the status below',
      statusNotSaved: 'Not saved', statusDirty: 'Unsaved changes',
      overrideBadge: 'Overridden', restoreDefault: 'Restore default', restoreDefaultAria: label => `Restore default ${label}`,
      detailsSummary: 'Reminders and loop defaults', discard: 'Discard', save: 'Save', saveBusy: 'Saving…',
      loop: {
        summary: 'Start or cancel a loop', note: 'These parameters apply to this start only; defaults are unchanged.',
        task: 'Task', verify: 'Verify command for this run (empty uses the model report)',
        iterations: 'Iteration cap for this run (0 = unlimited)', timeout: 'Verify timeout for this run (s)',
        start: 'Start loop', cancel: 'Cancel current loop',
      },
    },
    composer: {
      readingAria: 'PUA (loading session settings)', offAria: 'PUA (off for this session)', onAria: 'PUA (on for this session)',
      readingTitle: 'Loading session settings', offTitle: 'PUA is off — click to configure', onTitle: 'PUA is on — click to configure',
      dialogAria: 'PUA settings for this session', closePanel: 'Close settings panel', close: 'Close',
      readError: 'Could not read global settings. Check the connection or open the plugin settings page and retry.',
    },
    slash: {
      pua: {
        label: 'PUA',
        description: 'Turn on PUA task mode, switch flavor, change approach, or check verification evidence',
        hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|task]',
      },
      cancelLoop: { label: 'Cancel loop', description: 'Cancel the current session PUA Loop without interrupting an ordinary model task' },
    },
  },
  ja: {
    settingsSummary: 'コマンドとチャット入口、ペルソナスタイルとサブエージェント方針。',
    cardTitle: 'PUA 設定',
    cardToggle: open => `${open ? '折りたたむ' : '展開'}：PUA 設定`,
    allow: {
      label: 'PUA の使用を許可',
      description: 'オンにすると /pua とチャット入口を表示します。オフにすると両方非表示になり、個別セッションでも有効化できません。自動注入は行われません。',
    },
    fields: {
      enabled: 'PUA を有効化', flavor: 'スタイル', mode: 'ペルソナモード', subagents: 'サブエージェントに PUA を適用',
      terminalReview: 'ターミナル異常検証リマインダー', failureCandidates: '失敗エスカレーション候補のヒント', qualityTriggers: '品質是正プロンプト',
      integrityGuard: '不正防止ゲート',
      offline: 'フィードバック通知', feedbackFrequency: 'フィードバック通知頻度', maxIterations: 'Loop 周回数上限', verify: 'デフォルト検証コマンド', verificationTimeout: '検証タイムアウト（秒）',
      language: 'UI 言語',
    },
    languageChoices: {
      auto: '自動（ホストに追従）', 'zh-CN': '中国語', en: '英語', ja: '日本語',
      es: 'スペイン語', fr: 'フランス語', de: 'ドイツ語', ru: 'ロシア語', pt: 'ポルトガル語',
    },
    autoFlavor: '自動選択',
    descriptions: {
      subagents: 'デフォルトは無効。エキスパートプラグインの干渉を防ぎます。有効化時、親セッションの有効設定を継承しますが、ループや失敗数は引き継ぎません。',
      enabled: 'デフォルトは無効。/pua またはチャット入口で現在のセッションのみ有効化されます。',
      maxIterations: '0 は無制限。設定の保存では Loop は開始されません。',
      verify: '空欄の場合はモデルの報告を使用（独立した検証ではありません）。コマンドはセッションの作業ディレクトリで実行され、開始時に変更可能です。',
      verificationTimeout: '実行中の Loop は開始時に確定したパラメータを保持します。',
      feedbackFrequency: 'PUA の出力が目に見える形で配信された回数ごとに通知。0 で無効。外部送信はされません。',
      language: 'auto はホストの UI 言語に追従します。',
      integrityGuard: 'デフォルトは無効。ベンチマークの隠し解答を遮断し、テストや CI 資産の編集時に注意喚起を注入します。',
    },
    validation: {
      fallback: '保存に失敗しました。再試行してください。', invalid: 'の値が無効です。入力を確認してください',
      tooBig: max => max + ' を超えることはできません', tooSmall: min => min + ' 未満にすることはできません',
      join: '；', fieldFallback: '設定',
    },
    panel: {
      globalAria: 'PUA グローバル設定', sessionAria: 'PUA セッション設定', sessionHeading: '現在のセッション PUA',
      globalNote: '/pua とチャット入口の利用可否を制御します。個別に有効化済みのセッションは維持されます。',
      sessionNote: n => `現在のセッションのみ影響 · ${n} 項目カスタム済み。セッションはデフォルトで無効です。グローバルスイッチはコマンドと入口の可否のみ制御します。`,
      restoreAll: 'すべて継承に戻す',
      childNote: 'サブエージェントは未オーバーライド項目を親から継承します。親が無効またはサブエージェント禁止の場合、強制有効化はできません。',
      reload: '設定を再読込',
      statusLoading: '設定を読込中…', statusSynced: '設定を同期しました', statusSaving: '保存中…',
      statusSaved: '保存完了 · 次回モデルステップから適用',
      statusSavedSession: '保存完了。実際のオン/オフは親セッションとポリシーに制約されます。下記ステータスをご確認ください',
      statusNotSaved: '未保存', statusDirty: '未保存の変更があります',
      overrideBadge: 'カスタム済み', restoreDefault: 'デフォルトに戻す', restoreDefaultAria: label => `${label} のデフォルト値を復元`,
      detailsSummary: 'リマインダーと Loop デフォルト設定', discard: '変更を破棄', save: '保存', saveBusy: '保存中…',
      loop: {
        summary: 'Loop の開始またはキャンセル', note: '以下のパラメータは今回の開始にのみ適用され、デフォルト設定は変更されません。',
        task: 'タスク', verify: '今回の検証コマンド（空欄はモデル報告）',
        iterations: '今回の周回上限（0 は無制限）', timeout: '今回の検証タイムアウト（秒）',
        start: 'Loop を開始', cancel: '現在の Loop をキャンセル',
      },
    },
    composer: {
      readingAria: 'PUA（セッション設定読込中）', offAria: 'PUA（現在のセッションは無効）', onAria: 'PUA（現在のセッションは有効）',
      readingTitle: 'セッション設定読込中', offTitle: 'PUA は無効です。クリックして設定', onTitle: 'PUA は有効です。クリックして設定',
      dialogAria: '現在のセッションの PUA 設定', closePanel: '設定パネルを閉じる', close: '閉じる',
      readError: 'グローバル設定を読み込めません。接続を確認するかプラグイン設定ページを開いて再試行してください。',
    },
    slash: {
      pua: {
        label: '催促',
        description: 'PUA タスクモードの開始、スタイル切り替え、別アプローチの試行、または検証証拠の確認',
        hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|タスク説明]',
      },
      cancelLoop: { label: 'ループ中止', description: '通常のタスクを中断せずに現在のセッションの PUA Loop をキャンセル' },
    },
  },
  es: {
    settingsSummary: 'Comandos y acceso de chat, sabor de estilo y política de subagentes.',
    cardTitle: 'Configuración de PUA',
    cardToggle: open => `${open ? 'Contraer' : 'Expandir'}: Configuración de PUA`,
    allow: {
      label: 'Permitir PUA',
      description: 'Muestra /pua y el botón en el chat. Al desactivar, ambos se ocultan y no se puede activar en la sesión. No inyecta prompts automáticamente.',
    },
    fields: {
      enabled: 'Activar PUA', flavor: 'Sabor de estilo', mode: 'Modo de rol', subagents: 'Activar para subagentes',
      terminalReview: 'Avisos de revisión de terminal', failureCandidates: 'Pistas de escalado de fallos', qualityTriggers: 'Avisos de corrección de calidad',
      integrityGuard: 'Barrera antitrampas',
      offline: 'Recordatorios de valoración', feedbackFrequency: 'Frecuencia de valoración', maxIterations: 'Límite de iteraciones Loop', verify: 'Comando de verificación por defecto', verificationTimeout: 'Tiempo límite de verificación (s)',
      language: 'Idioma de interfaz',
    },
    languageChoices: {
      auto: 'Automático (seguir host)', 'zh-CN': 'Chino', en: 'English', ja: 'Japonés',
      es: 'Español', fr: 'Francés', de: 'Alemán', ru: 'Ruso', pt: 'Portugués',
    },
    autoFlavor: 'Automático',
    descriptions: {
      subagents: 'Desactivado por defecto para no interferir con plugins de expertos. Al activar, hereda la configuración efectiva del padre sin heredar bucles ni conteos de errores.',
      enabled: 'Desactivado por defecto. /pua o el botón de chat habilitan la inyección solo para esta conversación.',
      maxIterations: '0 significa sin límite. Guardar la configuración no inicia un bucle.',
      verify: 'Dejar vacío para usar el informe del modelo (no es una prueba independiente). El comando se ejecuta en el directorio de trabajo.',
      verificationTimeout: 'Los bucles en ejecución conservan los parámetros definidos al inicio.',
      feedbackFrequency: 'Aviso cada N entregas visibles de PUA; 0 desactiva. Nada se sube a la red.',
      language: 'auto sigue el idioma de la interfaz del host.',
      integrityGuard: 'Desactivado por defecto. Bloquea respuestas de referencia y avisa al editar pruebas o CI.',
    },
    validation: {
      fallback: 'Error al guardar, por favor reintenta.', invalid: ' tiene un valor no válido',
      tooBig: max => ' no puede superar ' + max, tooSmall: min => ' no puede ser inferior a ' + min,
      join: '; ', fieldFallback: 'Ajustes',
    },
    panel: {
      globalAria: 'Configuración global de PUA', sessionAria: 'Configuración de PUA de la sesión', sessionHeading: 'PUA para esta sesión',
      globalNote: 'Controla si el comando /pua y el botón de chat están disponibles. Las sesiones ya activadas se mantienen.',
      sessionNote: n => `Afecta solo a esta conversación · ${n} opciones modificadas. Inician apagadas; el interruptor global solo controla el acceso.`,
      restoreAll: 'Restaurar toda la herencia',
      childNote: 'Los subagentes heredan las claves no modificadas del padre; si el padre está apagado, esta sesión no puede forzar la activación.',
      reload: 'Recargar ajustes',
      statusLoading: 'Cargando ajustes…', statusSynced: 'Ajustes sincronizados', statusSaving: 'Guardando…',
      statusSaved: 'Guardado · surte efecto a partir del siguiente paso del modelo',
      statusSavedSession: 'Guardado; la activación real depende del padre y las políticas de subagente — consulta el estado inferior',
      statusNotSaved: 'No guardado', statusDirty: 'Cambios sin guardar',
      overrideBadge: 'Modificado', restoreDefault: 'Restaurar valor', restoreDefaultAria: label => `Restaurar valor por defecto de ${label}`,
      detailsSummary: 'Avisos y valores por defecto del Loop', discard: 'Descartar', save: 'Guardar', saveBusy: 'Guardando…',
      loop: {
        summary: 'Iniciar o cancelar Loop', note: 'Estos parámetros se aplican únicamente a esta ejecución.',
        task: 'Tarea', verify: 'Comando de verificación para este lanzamiento (vacío usa informe)',
        iterations: 'Tope de iteraciones para este lanzamiento (0 = ilimitado)', timeout: 'Tiempo límite de verificación (s)',
        start: 'Iniciar Loop', cancel: 'Cancelar Loop actual',
      },
    },
    composer: {
      readingAria: 'PUA (cargando ajustes de la sesión)', offAria: 'PUA (desactivado en esta sesión)', onAria: 'PUA (activado en esta sesión)',
      readingTitle: 'Cargando ajustes de sesión', offTitle: 'PUA desactivado — clic para configurar', onTitle: 'PUA activado — clic para configurar',
      dialogAria: 'Ajustes de PUA para esta sesión', closePanel: 'Cerrar panel de ajustes', close: 'Cerrar',
      readError: 'No se pudieron leer los ajustes globales. Comprueba la conexión o abre la página de complementos.',
    },
    slash: {
      pua: {
        label: 'Acelerar',
        description: 'Activar modo de tarea PUA, cambiar sabor, probar otro enfoque o comprobar evidencias',
        hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|tarea]',
      },
      cancelLoop: { label: 'Cancelar bucle', description: 'Cancelar el bucle PUA de la sesión actual sin interrumpir la tarea normal' },
    },
  },
  fr: {
    settingsSummary: 'Commandes et accès chat, style de persona et stratégie de sous-agents.',
    cardTitle: 'Paramètres PUA',
    cardToggle: open => `${open ? 'Réduire' : 'Développer'} : Paramètres PUA`,
    allow: {
      label: 'Autoriser PUA',
      description: 'Affiche /pua et le bouton dans le chat. Lorsque désactivé, les deux sont masqués et la session ne peut être activée. N\'injecte aucun prompt seul.',
    },
    fields: {
      enabled: 'Activer PUA', flavor: 'Style de persona', mode: 'Mode de rôle', subagents: 'Activer pour les sous-agents',
      terminalReview: 'Rappels de contrôle terminal', failureCandidates: 'Suggestions d\'escalade d\'échec', qualityTriggers: 'Invites de correction qualité',
      integrityGuard: 'Garde d\'intégrité',
      offline: 'Rappels d\'évaluation', feedbackFrequency: 'Fréquence d\'évaluation', maxIterations: 'Limite de tours du Loop', verify: 'Commande de vérification par défaut', verificationTimeout: 'Délai de vérification (s)',
      language: 'Langue de l\'interface',
    },
    languageChoices: {
      auto: 'Automatique (suivre l\'hôte)', 'zh-CN': 'Chinois', en: 'English', ja: 'Japonais',
      es: 'Espagnol', fr: 'Français', de: 'Allemand', ru: 'Russe', pt: 'Portugais',
    },
    autoFlavor: 'Automatique',
    descriptions: {
      subagents: 'Désactivé par défaut pour éviter d\'interférer avec les plugins d\'experts. Lorsqu\'activé, hérite de la configuration du parent.',
      enabled: 'Désactivé par défaut. /pua ou le bouton active l\'injection uniquement pour cette conversation.',
      maxIterations: '0 signifie illimité. L\'enregistrement ne démarre pas de boucle.',
      verify: 'Laisser vide pour utiliser le rapport du modèle. La commande s\'exécute dans le dossier de travail.',
      verificationTimeout: 'Les boucles actives conservent les paramètres définis au démarrage.',
      feedbackFrequency: 'Rappel toutes les N livraisons visibles de PUA ; 0 désactive. Aucune donnée n\'est envoyée.',
      language: 'auto suit la langue d\'interface de l\'hôte.',
      integrityGuard: 'Désactivé par défaut. Bloque les réponses de référence et alerte lors de modifications de tests ou de CI.',
    },
    validation: {
      fallback: 'Échec de l\'enregistrement, veuillez réessayer.', invalid: ' a une valeur non valide',
      tooBig: max => ' ne peut pas dépasser ' + max, tooSmall: min => ' ne peut pas être inférieur à ' + min,
      join: ' ; ', fieldFallback: 'Paramètres',
    },
    panel: {
      globalAria: 'Paramètres globaux PUA', sessionAria: 'Paramètres PUA de la session', sessionHeading: 'PUA pour cette session',
      globalNote: 'Contrôle la disponibilité de /pua et du bouton chat. Les sessions déjà activées restent actives.',
      sessionNote: n => `Concerne cette conversation uniquement · ${n} options personnalisées. Désactivé par défaut ; l\'interrupteur global contrôle uniquement l\'accès aux commandes et au chat.`,
      restoreAll: 'Tout rétablir par défaut',
      childNote: 'Un sous-agent hérite des valeurs du parent ; si le parent est désactivé, cette session ne peut pas forcer l\'activation.',
      reload: 'Recharger les paramètres',
      statusLoading: 'Chargement des paramètres…', statusSynced: 'Paramètres synchronisés', statusSaving: 'Enregistrement…',
      statusSaved: 'Enregistré · prend effet dès la prochaine étape du modèle',
      statusSavedSession: 'Enregistré ; l\'activation réelle dépend du parent et des règles de sous-agents — voir l\'état ci-dessous',
      statusNotSaved: 'Non enregistré', statusDirty: 'Modifications non enregistrées',
      overrideBadge: 'Personnalisé', restoreDefault: 'Rétablir', restoreDefaultAria: label => `Rétablir la valeur par défaut de ${label}`,
      detailsSummary: 'Rappels et paramètres par défaut du Loop', discard: 'Abandonner', save: 'Enregistrer', saveBusy: 'Enregistrement…',
      loop: {
        summary: 'Démarrer ou annuler un Loop', note: 'Ces paramètres s\'appliquent uniquement à ce lancement.',
        task: 'Tâche', verify: 'Commande de vérification pour ce tour (vide = rapport du modèle)',
        iterations: 'Limite de tours pour ce lancement (0 = illimité)', timeout: 'Délai de vérification (s)',
        start: 'Démarrer le Loop', cancel: 'Annuler le Loop actif',
      },
    },
    composer: {
      readingAria: 'PUA (chargement des paramètres de session)', offAria: 'PUA (désactivé pour cette session)', onAria: 'PUA (activé pour cette session)',
      readingTitle: 'Chargement des paramètres de session', offTitle: 'PUA désactivé — cliquer pour configurer', onTitle: 'PUA activé — cliquer pour configurer',
      dialogAria: 'Paramètres PUA pour cette session', closePanel: 'Fermer le panneau des paramètres', close: 'Fermer',
      readError: 'Impossible de lire les paramètres globaux. Vérifiez la connexion ou ouvrez la page des extensions.',
    },
    slash: {
      pua: {
        label: 'Relancer',
        description: 'Activer le mode tâche PUA, changer de style, changer d\'approche ou vérifier les preuves',
        hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|tâche]',
      },
      cancelLoop: { label: 'Annuler la boucle', description: 'Annuler le Loop PUA de la session active sans interrompre la tâche normale' },
    },
  },
  de: {
    settingsSummary: 'Befehle und Chat-Einstieg, Persona-Stil und Richtlinien für Unteragenten.',
    cardTitle: 'PUA-Einstellungen',
    cardToggle: open => `${open ? 'Einklappen' : 'Ausklappen'}: PUA-Einstellungen`,
    allow: {
      label: 'PUA zulassen',
      description: 'Zeigt /pua und den Chat-Einstieg an. Bei Deaktivierung werden beide ausgeblendet und die Einzelsitzung kann nicht aktiviert werden. Fügt keine Prompts von selbst ein.',
    },
    fields: {
      enabled: 'PUA aktivieren', flavor: 'Persona-Stil', mode: 'Rollenmodus', subagents: 'Für Unteragenten aktivieren',
      terminalReview: 'Terminal-Prüferinnerungen', failureCandidates: 'Hinweise auf Eskalationskandidaten', qualityTriggers: 'Qualitätskorrektur-Hinweise',
      integrityGuard: 'Integritätsschutz',
      offline: 'Feedback-Erinnerungen', feedbackFrequency: 'Feedback-Häufigkeit', maxIterations: 'Loop-Rundenlimit', verify: 'Standard-Prüfbefehl', verificationTimeout: 'Prüf-Timeout (s)',
      language: 'UI-Sprache',
    },
    languageChoices: {
      auto: 'Automatisch (Host folgen)', 'zh-CN': 'Chinesisch', en: 'English', ja: 'Japanisch',
      es: 'Spanisch', fr: 'Französisch', de: 'Deutsch', ru: 'Russisch', pt: 'Portugiesisch',
    },
    autoFlavor: 'Automatisch',
    descriptions: {
      subagents: 'Standardmäßig aus, um Experten-Plugins nicht zu stören. Bei Aktivierung werden Einstellungen der Hauptsitzung übernommen.',
      enabled: 'Standardmäßig aus. /pua oder der Chat-Button aktivieren die Prompt-Injektion nur für diese Konversation.',
      maxIterations: '0 bedeutet unbegrenzt. Das Speichern startet keinen Loop.',
      verify: 'Leer lassen für Modellbericht. Der Befehl wird im Arbeitsverzeichnis der Sitzung ausgeführt.',
      verificationTimeout: 'Laufende Loops behalten die beim Start bestätigten Parameter bei.',
      feedbackFrequency: 'Erinnerung alle N sichtbaren PUA-Ausgaben; 0 deaktiviert. Es werden keine Daten übertragen.',
      language: 'auto folgt der Oberflächensprache des Hosts.',
      integrityGuard: 'Standardmäßig aus. Verhindert das Auslesen von Benchmark-Lösungen und warnt bei Änderungen an Tests oder CI.',
    },
    validation: {
      fallback: 'Speichern fehlgeschlagen, bitte erneut versuchen.', invalid: ' hat einen ungültigen Wert',
      tooBig: max => ' darf nicht größer sein als ' + max, tooSmall: min => ' darf nicht kleiner sein als ' + min,
      join: '; ', fieldFallback: 'Einstellungen',
    },
    panel: {
      globalAria: 'Globale PUA-Einstellungen', sessionAria: 'PUA-Sitzungseinstellungen', sessionHeading: 'PUA für diese Sitzung',
      globalNote: 'Steuert die Verfügbarkeit von /pua und des Chat-Buttons. Bereits aktivierte Sitzungen bleiben aktiv.',
      sessionNote: n => `Betrifft nur diese Konversation · ${n} Optionen angepasst. Startet deaktiviert; der globale Schalter steuert nur den Befehls- und Chat-Zugriff.`,
      restoreAll: 'Alle Standardwerte wiederherstellen',
      childNote: 'Unteragenten erben nicht überschriebene Optionen von der Elternsitzung; ist diese aus, kann hier nicht aktiviert werden.',
      reload: 'Einstellungen neu laden',
      statusLoading: 'Einstellungen werden geladen…', statusSynced: 'Einstellungen synchronisiert', statusSaving: 'Wird gespeichert…',
      statusSaved: 'Gespeichert · wird ab dem nächsten Modellschritt wirksam',
      statusSavedSession: 'Gespeichert; tatsächliche Aktivierung hängt von Hauptsitzung und Unteragentenrichtlinien ab — siehe Status unten',
      statusNotSaved: 'Nicht gespeichert', statusDirty: 'Ungespeicherte Änderungen',
      overrideBadge: 'Angepasst', restoreDefault: 'Zurücksetzen', restoreDefaultAria: label => `Standardwert für ${label} wiederherstellen`,
      detailsSummary: 'Erinnerungen und Loop-Standardwerte', discard: 'Verwerfen', save: 'Speichern', saveBusy: 'Wird gespeichert…',
      loop: {
        summary: 'Loop starten oder abbrechen', note: 'Diese Parameter gelten nur für diesen Startlauf.',
        task: 'Aufgabe', verify: 'Prüfbefehl für diesen Lauf (leer = Modellbericht)',
        iterations: 'Rundenobergrenze für diesen Lauf (0 = unbegrenzt)', timeout: 'Prüf-Timeout (s)',
        start: 'Loop starten', cancel: 'Aktuellen Loop abbrechen',
      },
    },
    composer: {
      readingAria: 'PUA (Sitzungseinstellungen werden geladen)', offAria: 'PUA (für diese Sitzung deaktiviert)', onAria: 'PUA (für diese Sitzung aktiviert)',
      readingTitle: 'Sitzungseinstellungen werden geladen', offTitle: 'PUA ist aus — zum Konfigurieren klicken', onTitle: 'PUA ist an — zum Konfigurieren klicken',
      dialogAria: 'PUA-Einstellungen für diese Sitzung', closePanel: 'Einstellungsleiste schließen', close: 'Schließen',
      readError: 'Globale Einstellungen konnten nicht gelesen werden. Verbindung prüfen oder Plugin-Seite öffnen.',
    },
    slash: {
      pua: {
        label: 'Antreiben',
        description: 'PUA-Aufgabenmodus aktivieren, Stil wechseln, Ansatz ändern oder Belege prüfen',
        hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|Aufgabe]',
      },
      cancelLoop: { label: 'Schleife abbrechen', description: 'Aktuellen PUA-Loop der Sitzung abbrechen, ohne normale Modellaufgaben zu stören' },
    },
  },
  ru: {
    settingsSummary: 'Команды и чат-вход, персона-вкус и политика для под-агентов.',
    cardTitle: 'Настройки PUA',
    cardToggle: open => `${open ? 'Свернуть' : 'Развернуть'}: настройки PUA`,
    allow: {
      label: 'Разрешить PUA',
      description: 'Показывает /pua и чат-вход. Когда выключено, оба скрыты, и этот разговор нельзя включить. Сам ничего не внедряет.',
    },
    fields: {
      enabled: 'Включить PUA', flavor: 'Вкус (флейвор)', mode: 'Роль', subagents: 'Включить для под-агентов',
      terminalReview: 'Напоминания о проверке терминала', failureCandidates: 'Подсказки о кандидатах на эскалацию', qualityTriggers: 'Подсказки о коррекции качества',
      integrityGuard: 'Защита от подмены (integrity guard)',
      offline: 'Напоминания о фидбеке', feedbackFrequency: 'Частота напоминаний о фидбеке', maxIterations: 'Лимит итераций Loop', verify: 'Команда проверки по умолчанию', verificationTimeout: 'Таймаут проверки (сек)',
      language: 'Язык интерфейса',
    },
    languageChoices: {
      auto: 'Авто (следовать за хостом)', 'zh-CN': 'Китайский', en: 'English', ja: 'Японский',
      es: 'Испанский', fr: 'Французский', de: 'Немецкий', ru: 'Русский', pt: 'Португальский',
    },
    autoFlavor: 'Авто',
    descriptions: {
      subagents: 'Выключено по умолчанию, чтобы не мешать экспертным плагинам. При включении под-агенты наследуют действующую конфигурацию родительской сессии, но не циклы и счётчики ошибок.',
      enabled: 'Выключено по умолчанию. /pua или чат-вход включает внедрение только для этого разговора.',
      maxIterations: '0 означает без ограничений. Сохранение настроек не запускает цикл.',
      verify: 'Оставьте пустым, чтобы использовать отчёт модели — это не независимая проверка. Команда выполняется в рабочем каталоге сессии и может быть изменена при запуске цикла.',
      verificationTimeout: 'Запущенные циклы сохраняют параметры, подтверждённые при старте.',
      feedbackFrequency: 'Напоминать один раз на каждые N доставленных результатов с видимой активностью PUA; 0 отключает. Ничего не загружается.',
      language: 'auto следует за языком интерфейса хоста.',
      integrityGuard: 'Выключено по умолчанию. При включении отклоняет скрытые эталонные ответы и напоминает, когда правки затрагивают тесты, скоринг или CI-активы.',
    },
    validation: {
      fallback: 'Сохранение не удалось, попробуйте снова.', invalid: ' имеет недопустимое значение',
      tooBig: max => ' не может превышать ' + max, tooSmall: min => ' не может быть меньше ' + min,
      join: '; ', fieldFallback: 'Настройки',
    },
    panel: {
      globalAria: 'Глобальные настройки PUA', sessionAria: 'Настройки PUA для сессии', sessionHeading: 'PUA для этой сессии',
      globalNote: 'Управляет доступностью /pua и чат-входа. Переключатели, уже включённые в разговоре, остаются включёнными.',
      sessionNote: n => `Влияет только на этот разговор · переопределено: ${n}. Разговоры начинаются выключенными; глобальный переключатель управляет только командой и чат-входом.`,
      restoreAll: 'Восстановить всё наследование',
      childNote: 'Под-агент наследует родительскую сессию для ключей, которые он не переопределил; когда родительская сессия выключена или запрещает под-агентов, эта сессия не может принудительно включить.',
      reload: 'Перечитать настройки',
      statusLoading: 'Загрузка настроек…', statusSynced: 'Настройки синхронизированы', statusSaving: 'Сохранение…',
      statusSaved: 'Сохранено · вступает в силу со следующего шага модели',
      statusSavedSession: 'Сохранено; фактический переключатель ограничен родительской сессией и политикой под-агентов — см. статус ниже',
      statusNotSaved: 'Не сохранено', statusDirty: 'Есть несохранённые изменения',
      overrideBadge: 'Переопределено', restoreDefault: 'Восстановить по умолчанию', restoreDefaultAria: label => `Восстановить значение по умолчанию: ${label}`,
      detailsSummary: 'Напоминания и параметры Loop по умолчанию', discard: 'Отменить изменения', save: 'Сохранить', saveBusy: 'Сохранение…',
      loop: {
        summary: 'Запустить или отменить цикл', note: 'Эти параметры применяются только к этому запуску; значения по умолчанию не меняются.',
        task: 'Задача', verify: 'Команда проверки для этого запуска (пусто — отчёт модели)',
        iterations: 'Лимит итераций для этого запуска (0 = без ограничений)', timeout: 'Таймаут проверки для этого запуска (сек)',
        start: 'Запустить цикл', cancel: 'Отменить текущий цикл',
      },
    },
    composer: {
      readingAria: 'PUA (загрузка настроек сессии)', offAria: 'PUA (выключен для этой сессии)', onAria: 'PUA (включён для этой сессии)',
      readingTitle: 'Загрузка настроек сессии', offTitle: 'PUA выключен — нажмите, чтобы настроить', onTitle: 'PUA включён — нажмите, чтобы настроить',
      dialogAria: 'Настройки PUA для этой сессии', closePanel: 'Закрыть панель настроек', close: 'Закрыть',
      readError: 'Не удалось прочитать глобальные настройки. Проверьте соединение или откройте страницу настроек плагина и повторите.',
    },
    slash: {
      pua: {
        label: 'PUA',
        description: 'Включить режим задач PUA, сменить вкус, изменить подход или проверить доказательства',
        hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|задача]',
      },
      cancelLoop: { label: 'Отменить цикл', description: 'Отменить текущий PUA Loop сессии, не прерывая обычную задачу модели' },
    },
  },
  pt: {
    settingsSummary: 'Comandos e entrada no chat, estilo de persona e política de subagentes.',
    cardTitle: 'Configurações de PUA',
    cardToggle: open => `${open ? 'Recolher' : 'Expandir'}: Configurações de PUA`,
    allow: {
      label: 'Permitir PUA',
      description: 'Exibe o comando /pua e a entrada no chat. Quando desativado, ambos ficam ocultos e a sessão não pode ser ligada. Não injeta prompts automaticamente.',
    },
    fields: {
      enabled: 'Ativar PUA', flavor: 'Estilo de persona', mode: 'Modo de papel', subagents: 'Ativar para subagentes',
      terminalReview: 'Lembretes de revisão de terminal', failureCandidates: 'Dicas de escalonamento de falhas', qualityTriggers: 'Avisos de correção de qualidade',
      integrityGuard: 'Proteção de integridade',
      offline: 'Lembretes de avaliação', feedbackFrequency: 'Frequência de lembretes', maxIterations: 'Limite de iterações do Loop', verify: 'Comando de verificação padrão', verificationTimeout: 'Tempo limite de verificação (s)',
      language: 'Idioma da interface',
    },
    languageChoices: {
      auto: 'Automático (seguir host)', 'zh-CN': 'Chinês', en: 'English', ja: 'Japonês',
      es: 'Espanhol', fr: 'Francês', de: 'Alemão', ru: 'Russo', pt: 'Português',
    },
    autoFlavor: 'Automático',
    descriptions: {
      subagents: 'Desativado por padrão para evitar interferência em plugins especialistas. Ao ativar, herda a configuração efetiva da sessão pai.',
      enabled: 'Desativado por padrão. /pua ou a entrada no chat ativam a injeção apenas para esta conversa.',
      maxIterations: '0 significa ilimitado. Salvar configurações não inicia um Loop.',
      verify: 'Deixe em branco para usar o relatório do modelo. O comando executa no diretório da sessão.',
      verificationTimeout: 'Loops em execução mantêm os parâmetros confirmados no início.',
      feedbackFrequency: 'Lembrete a cada N entregas visíveis do PUA; 0 desativa. Nada é enviado para a rede.',
      language: 'auto acompanha o idioma da interface do host.',
      integrityGuard: 'Desativado por padrão. Bloqueia respostas de referência e alerta ao editar testes ou CI.',
    },
    validation: {
      fallback: 'Falha ao salvar, tente novamente.', invalid: ' possui um valor inválido',
      tooBig: max => ' não pode exceder ' + max, tooSmall: min => ' não pode ser menor que ' + min,
      join: '; ', fieldFallback: 'Configurações',
    },
    panel: {
      globalAria: 'Configurações globais de PUA', sessionAria: 'Configurações de PUA da sessão', sessionHeading: 'PUA para esta sessão',
      globalNote: 'Controla a disponibilidade de /pua e do botão no chat. Sessões já ativadas mantêm o estado.',
      sessionNote: n => `Afeta apenas esta conversa · ${n} opções personalizadas. Conversas iniciam desligadas; o interruptor global apenas controla o comando e a entrada no chat.`,
      restoreAll: 'Restaurar toda herança',
      childNote: 'Um subagente herda opções não personalizadas da sessão pai; se a sessão pai estiver desligada, não pode forçar ativação.',
      reload: 'Recarregar configurações',
      statusLoading: 'Carregando configurações…', statusSynced: 'Configurações sincronizadas', statusSaving: 'Salvando…',
      statusSaved: 'Salvo · vigora a partir da próxima etapa do modelo',
      statusSavedSession: 'Salvo; o interruptor real é restrito pela sessão pai e políticas de subagente — veja o status abaixo',
      statusNotSaved: 'Não salvo', statusDirty: 'Alterações não salvas',
      overrideBadge: 'Personalizado', restoreDefault: 'Restaurar padrão', restoreDefaultAria: label => `Restaurar padrão de ${label}`,
      detailsSummary: 'Lembretes e padrões do Loop', discard: 'Descartar', save: 'Salvar', saveBusy: 'Salvando…',
      loop: {
        summary: 'Iniciar ou cancelar Loop', note: 'Estes parâmetros aplicam-se apenas a esta execução.',
        task: 'Tarefa', verify: 'Comando de verificação para esta execução (vazio usa relatório)',
        iterations: 'Teto de iterações para esta execução (0 = ilimitado)', timeout: 'Tempo limite de verificação (s)',
        start: 'Iniciar Loop', cancel: 'Cancelar Loop atual',
      },
    },
    composer: {
      readingAria: 'PUA (carregando configurações da sessão)', offAria: 'PUA (desligado para esta sessão)', onAria: 'PUA (ligado para esta sessão)',
      readingTitle: 'Carregando configurações da sessão', offTitle: 'PUA desligado — clique para configurar', onTitle: 'PUA ligado — clique para configurar',
      dialogAria: 'Configurações de PUA para esta sessão', closePanel: 'Fechar painel de configurações', close: 'Fechar',
      readError: 'Não foi possível ler as configurações globais. Verifique a conexão ou abra a página de plugins.',
    },
    slash: {
      pua: {
        label: 'Acelerar',
        description: 'Ativar modo de tarefa PUA, trocar estilo, mudar abordagem ou checar evidências',
        hint: '[on|off|flavor|p7|p9|p10|pro|loop|review|again|status|help|tarefa]',
      },
      cancelLoop: { label: 'Cancelar loop', description: 'Cancelar o Loop PUA da sessão atual sem interromper tarefas normais' },
    },
  },
};

export interface ActivityCopy {
  ariaLabel: string;
  statusVerifying: string; statusLoop: string; statusTask: string;
  iteration: (current: number, max: number) => string;
  fields: { mode: string; flavor: string; subagents: string; loopIterations: string; verification: string; timeout: string; failures: string; rejections: string };
  on: string; off: string; auto: string; unlimited: string; byCommand: string; byModel: string;
  seconds: (t: number) => string; timeoutNA: string; times: (n: number) => string;
  toggle: (open: boolean) => string; cancelBusy: string; cancel: string; cancelFailed: string;
}

export const ACTIVITY: Record<UiLang, ActivityCopy> = {
  zh: {
    ariaLabel: 'PUA 运行状态',
    statusVerifying: '正在验收', statusLoop: 'Loop 运行中', statusTask: '任务执行中',
    iteration: (current, max) => `第 ${current} 轮${max > 0 ? ` / ${max} 轮` : ''}`,
    fields: { mode: '角色模式', flavor: '风味', subagents: '对子代理启用', loopIterations: 'Loop 轮次', verification: '验收方式', timeout: '验收超时', failures: '连续终端失败观察', rejections: '验收未通过' },
    on: '开启', off: '关闭', auto: '自动', unlimited: '不限', byCommand: '独立验收命令', byModel: '模型报告',
    seconds: t => `${t} 秒`, timeoutNA: '不适用', times: n => `${n} 次`,
    toggle: open => (open ? '收起' : '展开'), cancelBusy: '正在取消…', cancel: '取消 Loop', cancelFailed: '取消失败，请重试。',
  },
  en: {
    ariaLabel: 'PUA activity',
    statusVerifying: 'Verifying', statusLoop: 'Loop running', statusTask: 'Task running',
    iteration: (current, max) => `Round ${current}${max > 0 ? ` of ${max}` : ''}`,
    fields: { mode: 'Role mode', flavor: 'Flavor', subagents: 'Subagents', loopIterations: 'Loop iterations', verification: 'Verification', timeout: 'Verify timeout', failures: 'Terminal failures', rejections: 'Rejected checks' },
    on: 'On', off: 'Off', auto: 'Auto', unlimited: 'unlimited', byCommand: 'Verify command', byModel: 'Model report',
    seconds: t => `${t} s`, timeoutNA: 'N/A', times: n => String(n),
    toggle: open => (open ? 'Collapse' : 'Expand'), cancelBusy: 'Canceling…', cancel: 'Cancel loop', cancelFailed: 'Failed to cancel, please retry.',
  },
  ja: {
    ariaLabel: 'PUA 実行ステータス',
    statusVerifying: '検証中', statusLoop: 'Loop 実行中', statusTask: 'タスク実行中',
    iteration: (current, max) => `第 ${current} 周回${max > 0 ? ` / ${max} 周回` : ''}`,
    fields: { mode: 'ペルソナモード', flavor: 'スタイル', subagents: 'サブエージェント適用', loopIterations: 'Loop 周回数', verification: '検証方式', timeout: '検証タイムアウト', failures: 'ターミナル連続失敗', rejections: '検証未通過' },
    on: '有効', off: '無効', auto: '自動', unlimited: '無制限', byCommand: '検証コマンド', byModel: 'モデル報告',
    seconds: t => `${t} 秒`, timeoutNA: '該当なし', times: n => `${n} 回`,
    toggle: open => (open ? '折りたたむ' : '展開'), cancelBusy: 'キャンセル中…', cancel: 'Loop をキャンセル', cancelFailed: 'キャンセルに失敗しました。再試行してください。',
  },
  es: {
    ariaLabel: 'Actividad de PUA',
    statusVerifying: 'Verificando', statusLoop: 'Loop en ejecución', statusTask: 'Tarea en ejecución',
    iteration: (current, max) => `Ronda ${current}${max > 0 ? ` de ${max}` : ''}`,
    fields: { mode: 'Modo de rol', flavor: 'Sabor de estilo', subagents: 'Subagentes', loopIterations: 'Iteraciones Loop', verification: 'Verificación', timeout: 'Tiempo de verificación', failures: 'Fallos de terminal', rejections: 'Verificaciones rechazadas' },
    on: 'Activo', off: 'Inactivo', auto: 'Auto', unlimited: 'ilimitado', byCommand: 'Comando de verificación', byModel: 'Informe del modelo',
    seconds: t => `${t} s`, timeoutNA: 'N/A', times: n => String(n),
    toggle: open => (open ? 'Contraer' : 'Expandir'), cancelBusy: 'Cancelando…', cancel: 'Cancelar loop', cancelFailed: 'Error al cancelar, reintenta.',
  },
  fr: {
    ariaLabel: 'Activité PUA',
    statusVerifying: 'Vérification', statusLoop: 'Loop en cours', statusTask: 'Tâche en cours',
    iteration: (current, max) => `Tour ${current}${max > 0 ? ` sur ${max}` : ''}`,
    fields: { mode: 'Mode de rôle', flavor: 'Style', subagents: 'Sous-agents', loopIterations: 'Tours de Loop', verification: 'Vérification', timeout: 'Délai de vérification', failures: 'Échecs terminal', rejections: 'Vérifications rejetées' },
    on: 'Activé', off: 'Désactivé', auto: 'Auto', unlimited: 'illimité', byCommand: 'Commande de vérification', byModel: 'Rapport du modèle',
    seconds: t => `${t} s`, timeoutNA: 'S/O', times: n => String(n),
    toggle: open => (open ? 'Réduire' : 'Développer'), cancelBusy: 'Annulation…', cancel: 'Annuler le loop', cancelFailed: 'Échec de l\'annulation, veuillez réessayer.',
  },
  de: {
    ariaLabel: 'PUA-Aktivität',
    statusVerifying: 'Verifizierung', statusLoop: 'Loop läuft', statusTask: 'Aufgabe läuft',
    iteration: (current, max) => `Runde ${current}${max > 0 ? ` von ${max}` : ''}`,
    fields: { mode: 'Rollenmodus', flavor: 'Stil', subagents: 'Unteragenten', loopIterations: 'Loop-Runden', verification: 'Verifikation', timeout: 'Verifikations-Timeout', failures: 'Terminal-Fehlschläge', rejections: 'Abgelehnte Prüfungen' },
    on: 'Ein', off: 'Aus', auto: 'Auto', unlimited: 'unbegrenzt', byCommand: 'Prüfbefehl', byModel: 'Modellbericht',
    seconds: t => `${t} s`, timeoutNA: 'N/A', times: n => String(n),
    toggle: open => (open ? 'Einklappen' : 'Ausklappen'), cancelBusy: 'Wird abgebrochen…', cancel: 'Loop abbrechen', cancelFailed: 'Abbruch fehlgeschlagen, bitte erneut versuchen.',
  },
  ru: {
    ariaLabel: 'Активность PUA',
    statusVerifying: 'Проверка', statusLoop: 'Цикл выполняется', statusTask: 'Задача выполняется',
    iteration: (current, max) => `Раунд ${current}${max > 0 ? ` из ${max}` : ''}`,
    fields: { mode: 'Роль', flavor: 'Вкус (флейвор)', subagents: 'Под-агенты', loopIterations: 'Итерации Loop', verification: 'Проверка', timeout: 'Таймаут проверки', failures: 'Ошибки терминала', rejections: 'Отклонённые проверки' },
    on: 'Вкл', off: 'Выкл', auto: 'Авто', unlimited: 'без ограничений', byCommand: 'Команда проверки', byModel: 'Отчёт модели',
    seconds: t => `${t} с`, timeoutNA: 'Н/П', times: n => String(n),
    toggle: open => (open ? 'Свернуть' : 'Развернуть'), cancelBusy: 'Отмена…', cancel: 'Отменить цикл', cancelFailed: 'Не удалось отменить, попробуйте снова.',
  },
  pt: {
    ariaLabel: 'Atividade do PUA',
    statusVerifying: 'Verificando', statusLoop: 'Loop em execução', statusTask: 'Tarefa em execução',
    iteration: (current, max) => `Rodada ${current}${max > 0 ? ` de ${max}` : ''}`,
    fields: { mode: 'Modo de papel', flavor: 'Estilo', subagents: 'Subagentes', loopIterations: 'Iterações do Loop', verification: 'Verificação', timeout: 'Tempo de verificação', failures: 'Falhas de terminal', rejections: 'Verificações rejeitadas' },
    on: 'Ligado', off: 'Desligado', auto: 'Auto', unlimited: 'ilimitado', byCommand: 'Comando de verificação', byModel: 'Relatório do modelo',
    seconds: t => `${t} s`, timeoutNA: 'N/A', times: n => String(n),
    toggle: open => (open ? 'Recolher' : 'Expandir'), cancelBusy: 'Cancelando…', cancel: 'Cancelar loop', cancelFailed: 'Falha ao cancelar, tente novamente.',
  },
};

export const SESSION_RESULT_PREFIXES: Record<UiLang, string> = {
  zh: 'PUA · 会话 · ',
  en: 'PUA · Session · ',
  ja: 'PUA · セッション · ',
  es: 'PUA · Sesión · ',
  fr: 'PUA · Session · ',
  de: 'PUA · Sitzung · ',
  ru: 'PUA · Сессия · ',
  pt: 'PUA · Sessão · ',
};

export function sessionResultPrefix(lang: UiLang = 'zh'): string {
  return SESSION_RESULT_PREFIXES[lang] ?? SESSION_RESULT_PREFIXES.zh;
}

export function localizedListFlavors(lang: UiLang = 'zh'): string {
  if (lang === 'zh') return FLAVORS.map(item => `${item.id}（${item.label}）`).join('、');
  return FLAVORS.map(item => `${item.id} (${flavorLabel(item.id, lang)})`).join(', ');
}

export interface CommandCopy {
  flavorExample: string;
  statusText: (enabled: boolean, mode: string, flavor: string, scope: string, runtimeStatus: string) => string;
  autoRouting: string;
  locked: (flavor: string) => string;
  noAgents: string;
  agentsFootnote: string;
  reapOrphans: string;
  puaDisallowed: string;
  loopRequiresSubprocess: string;
  configureSaved: string;
  loopCanceled: string;
  stoppedLoops: (n: number) => string;
  offline: string;
  off: (scope: string) => string;
  flavorLocked: (flavor: string, enabled: boolean, scope: string) => string;
  flavorAuto: (enabled: boolean, scope: string) => string;
  taskModeEnabled: (flavor: string) => string;
  taskSubmitted: (kind: string, flavor: string, loopInfo: string, evidenceInfo: string) => string;
  taskKinds: Record<string, string>;
  loopOracleUser: string;
  loopOracleHonor: string;
  gitEvidenceMissing: string;
  commandCanceled: string;
}

export const COMMAND_COPY: Record<UiLang, CommandCopy> = {
  zh: {
    flavorExample: '例如：/pua flavor huawei',
    statusText: (enabled, mode, flavor, scope, runtime) => `${enabled ? '已开启' : '已关闭'}；模式：${mode}；风味：${flavor}。\n${scope}；原版 3.5.1 完整正文。${runtime ? '\n' + runtime : ''}`,
    autoRouting: '自动路由',
    locked: f => `${f}（锁定）`,
    noAgents: '宿主未提供子代理状态。',
    agentsFootnote: 'DSH Agent 由宿主管理，无原版 PID/TTL 文件。',
    reapOrphans: 'DSH 已在取消、异常结束和卸载时回收本插件循环；没有独立后台进程或 .claude 孤儿状态可清理。其他工具的子代理/worktree 由所属工具管理。',
    puaDisallowed: '已关闭「允许使用 PUA」，当前会话不能开启。请在「插件」中打开 @michengai/dsh-pua，打开「允许使用 PUA」后再使用。',
    loopRequiresSubprocess: '独立验收需要宿主 subprocess 和会话工作目录；未启动循环。',
    configureSaved: '会话配置已保存；未覆盖项继续跟随全局。',
    loopCanceled: '当前 Loop 已取消，不再自动续轮。',
    stoppedLoops: n => `已停止本插件管理的 ${n} 个循环；未删除宿主子代理或其他工具的 worktree。`,
    offline: '保持本地模式，无联网刷新或上报能力。',
    off: scope => `PUA 已关闭，Loop 已取消。范围：${scope}。`,
    flavorLocked: (f, enabled, scope) => `已锁定${f}；当前模式${enabled ? '已开启' : '仍关闭'}。范围：${scope}。`,
    flavorAuto: (enabled, scope) => `已恢复自动路由；当前模式${enabled ? '已开启' : '仍关闭'}。范围：${scope}。`,
    taskModeEnabled: f => `当前任务模式已开启，风味：${f}，从下次模型步骤生效。`,
    taskSubmitted: (kind, f, loop, evi) => `已提交${kind}，风味：${f}。请查看 Agent 后续结果。${loop}${evi}`,
    taskKinds: { review: '只读审查', loop: 'Loop', 'done-check': '完成检查', evidence: '证据检查', again: '换方法请求', activate: '任务请求' },
    loopOracleUser: '\nOracle：用户指定验证命令。',
    loopOracleHonor: '\n未配置 Oracle，仅 honor system。',
    gitEvidenceMissing: '\nGit 预检未取得证据，已要求 Agent 补充只读验证。',
    commandCanceled: 'PUA 命令已取消。',
  },
  en: {
    flavorExample: 'Example: /pua flavor huawei',
    statusText: (enabled, mode, flavor, scope, runtime) => `${enabled ? 'Enabled' : 'Disabled'}; Mode: ${mode}; Flavor: ${flavor}.\n${scope}; Upstream 3.5.1 full prompt.${runtime ? '\n' + runtime : ''}`,
    autoRouting: 'Auto routed',
    locked: f => `${f} (locked)`,
    noAgents: 'Host does not provide subagent status.',
    agentsFootnote: 'DSH Agents are managed by the host, without upstream PID/TTL files.',
    reapOrphans: 'DSH cleans up loops managed by this plugin upon cancellation, error, or unload; no background processes or .claude orphan states to clean up. Other tools manage their own subagents and worktrees.',
    puaDisallowed: 'Allow PUA is disabled; this session cannot be enabled. Please open @michengai/dsh-pua in Plugins and enable Allow PUA first.',
    loopRequiresSubprocess: 'Independent verification requires host subprocess and session working directory; loop not started.',
    configureSaved: 'Session configuration saved; unoverridden options continue following global defaults.',
    loopCanceled: 'Current Loop has been canceled; no further iterations will run.',
    stoppedLoops: n => `Stopped ${n} loops managed by this plugin; host subagents and worktrees from other tools were not removed.`,
    offline: 'Local mode active; no network refresh or telemetry reporting.',
    off: scope => `PUA disabled and Loop canceled. Scope: ${scope}.`,
    flavorLocked: (f, enabled, scope) => `Locked to ${f}; mode is currently ${enabled ? 'enabled' : 'disabled'}. Scope: ${scope}.`,
    flavorAuto: (enabled, scope) => `Restored auto routing; mode is currently ${enabled ? 'enabled' : 'disabled'}. Scope: ${scope}.`,
    taskModeEnabled: f => `Task mode enabled with flavor: ${f}, takes effect from the next model step.`,
    taskSubmitted: (kind, f, loop, evi) => `Submitted ${kind}, flavor: ${f}. Please check Agent results below.${loop}${evi}`,
    taskKinds: { review: 'read-only review', loop: 'Loop', 'done-check': 'completion check', evidence: 'evidence check', again: 'different approach request', activate: 'task request' },
    loopOracleUser: '\nOracle: user-specified verify command.',
    loopOracleHonor: '\nOracle not configured, honor system only.',
    gitEvidenceMissing: '\nGit check found no evidence, Agent requested to perform read-only verification.',
    commandCanceled: 'PUA command was canceled.',
  },
  ja: {
    flavorExample: '例：/pua flavor huawei',
    statusText: (enabled, mode, flavor, scope, runtime) => `${enabled ? '有効' : '無効'}；モード：${mode}；スタイル：${flavor}。\n${scope}；オリジナル 3.5.1 全文。${runtime ? '\n' + runtime : ''}`,
    autoRouting: '自動ルーティング',
    locked: f => `${f}（固定）`,
    noAgents: 'ホストからサブエージェントの状態が提供されていません。',
    agentsFootnote: 'DSH Agent はホストによって管理され、オリジナルの PID/TTL ファイルはありません。',
    reapOrphans: 'DSH はキャンセル、異常終了、アンロード時に本プラグインのループを回収します。クリーンアップ対象のバックグラウンドプロセスや孤立状態はありません。他ツールのサブエージェント/worktree は各ツールが管理します。',
    puaDisallowed: '「PUA の使用を許可」が無効化されているため、現在のセッションを有効化できません。サイドバー「プラグイン」で @michengai/dsh-pua を開き、「PUA の使用を許可」を有効にしてください。',
    loopRequiresSubprocess: '独立検証にはホストの subprocess と作業ディレクトリが必要です。ループは開始されませんでした。',
    configureSaved: 'セッション設定を保存しました。未オーバーライド項目は引き続きグローバル設定を継承します。',
    loopCanceled: '現在の Loop をキャンセルしました。これ以上周回は実行されません。',
    stoppedLoops: n => `本プラグインが管理する ${n} 個のループを停止しました。他ツールのサブエージェントや worktree は削除されていません。`,
    offline: 'ローカルモードを維持。ネットワーク通信や外部送信は行いません。',
    off: scope => `PUA を無効化し、Loop をキャンセルしました。範囲：${scope}。`,
    flavorLocked: (f, enabled, scope) => `${f} に固定しました；現在のモードは${enabled ? '有効' : '無効'}です。範囲：${scope}。`,
    flavorAuto: (enabled, scope) => `自動選択に復元しました；現在のモードは${enabled ? '有効' : '無効'}です。範囲：${scope}。`,
    taskModeEnabled: f => `タスクモードを有効化しました（スタイル：${f}）。次回のモデルステップから適用されます。`,
    taskSubmitted: (kind, f, loop, evi) => `${kind} を送信しました（スタイル：${f}）。Agent の実行結果をご確認ください。${loop}${evi}`,
    taskKinds: { review: '読み取り専用レビュー', loop: 'Loop', 'done-check': '完了チェック', evidence: '証拠チェック', again: '別アプローチ要求', activate: 'タスク要求' },
    loopOracleUser: '\nOracle：ユーザー指定の検証コマンド。',
    loopOracleHonor: '\nOracle 未設定、honor system のみ。',
    gitEvidenceMissing: '\nGit 証拠が取得できなかったため、Agent に読み取り専用検証の補完を指示しました。',
    commandCanceled: 'PUA コマンドがキャンセルされました。',
  },
  es: {
    flavorExample: 'Ejemplo: /pua flavor huawei',
    statusText: (enabled, mode, flavor, scope, runtime) => `${enabled ? 'Activado' : 'Desactivado'}; Modo: ${mode}; Sabor: ${flavor}.\n${scope}; Texto original 3.5.1 completo.${runtime ? '\n' + runtime : ''}`,
    autoRouting: 'Ruta automática',
    locked: f => `${f} (bloqueado)`,
    noAgents: 'El host no proporciona el estado de subagentes.',
    agentsFootnote: 'Los agentes DSH son administrados por el host, sin archivos PID/TTL originales.',
    reapOrphans: 'DSH limpia los bucles de este plugin tras cancelación, error o descarga; no hay procesos en segundo plano que limpiar. Otras herramientas gestionan sus propios subagentes y worktrees.',
    puaDisallowed: '«Permitir PUA» está desactivado; esta sesión no puede activarse. Abre @michengai/dsh-pua en Complementos y actívalo primero.',
    loopRequiresSubprocess: 'La verificación independiente requiere subprocess del host y directorio de trabajo; bucle no iniciado.',
    configureSaved: 'Configuración de sesión guardada; las opciones no modificadas siguen los valores globales.',
    loopCanceled: 'El bucle Loop actual ha sido cancelado; no se ejecutarán más rondas.',
    stoppedLoops: n => `Se han detenido ${n} bucles gestionados por este complemento; no se eliminaron subagentes ni worktrees de otras herramientas.`,
    offline: 'Modo local activo; sin comunicación de red ni telemetría.',
    off: scope => `PUA desactivado y Loop cancelado. Ámbito: ${scope}.`,
    flavorLocked: (f, enabled, scope) => `Fijado a ${f}; el modo está ${enabled ? 'activo' : 'inactivo'}. Ámbito: ${scope}.`,
    flavorAuto: (enabled, scope) => `Ruta automática restaurada; el modo está ${enabled ? 'activo' : 'inactivo'}. Ámbito: ${scope}.`,
    taskModeEnabled: f => `Modo de tarea activado con sabor: ${f}; surte efecto a partir del siguiente paso del modelo.`,
    taskSubmitted: (kind, f, loop, evi) => `Se ha enviado ${kind}, sabor: ${f}. Revisa los resultados del agente a continuación.${loop}${evi}`,
    taskKinds: { review: 'revisión de solo lectura', loop: 'Loop', 'done-check': 'comprobación de finalización', evidence: 'comprobación de evidencias', again: 'solicitud de otro enfoque', activate: 'solicitud de tarea' },
    loopOracleUser: '\nOracle: comando de verificación especificado por el usuario.',
    loopOracleHonor: '\nOracle no configurado, solo honor system.',
    gitEvidenceMissing: '\nNo se obtuvieron evidencias de Git, se requirió al agente comprobación adicional.',
    commandCanceled: 'El comando PUA fue cancelado.',
  },
  fr: {
    flavorExample: 'Exemple : /pua flavor huawei',
    statusText: (enabled, mode, flavor, scope, runtime) => `${enabled ? 'Activé' : 'Désactivé'} ; Mode : ${mode} ; Style : ${flavor}.\n${scope} ; Texte original 3.5.1 complet.${runtime ? '\n' + runtime : ''}`,
    autoRouting: 'Routage automatique',
    locked: f => `${f} (verrouillé)`,
    noAgents: "L'hôte ne fournit pas l'état des sous-agents.",
    agentsFootnote: "Les agents DSH sont gérés par l'hôte, sans fichiers PID/TTL d'origine.",
    reapOrphans: "DSH nettoie les boucles de ce plugin en cas d'annulation, d'erreur ou de déchargement ; aucun processus en arrière-plan à nettoyer. Les autres outils gèrent leurs propres sous-agents et worktrees.",
    puaDisallowed: "« Autoriser PUA » est désactivé ; cette session ne peut pas être activée. Ouvrez @michengai/dsh-pua dans Extensions et activez-le d'abord.",
    loopRequiresSubprocess: "La vérification indépendante nécessite subprocess de l'hôte et le répertoire de travail ; boucle non lancée.",
    configureSaved: 'Configuration de session enregistrée ; les options non modifiées suivent les valeurs globales.',
    loopCanceled: 'Le Loop actif a été annulé ; aucun tour supplémentaire ne sera exécuté.',
    stoppedLoops: n => `Arrêt de ${n} boucles gérées par cette extension ; les sous-agents et worktrees d'autres outils n'ont pas été supprimés.`,
    offline: 'Mode local actif ; aucune actualisation réseau ni télémétrie.',
    off: scope => `PUA désactivé et Loop annulé. Périmètre : ${scope}.`,
    flavorLocked: (f, enabled, scope) => `Verrouillé sur ${f} ; le mode est actuellement ${enabled ? 'activé' : 'désactivé'}. Périmètre : ${scope}.`,
    flavorAuto: (enabled, scope) => `Sélection automatique rétablie ; le mode est actuellement ${enabled ? 'activé' : 'désactivé'}. Périmètre : ${scope}.`,
    taskModeEnabled: f => `Mode tâche activé avec le style : ${f}, prend effet dès la prochaine étape du modèle.`,
    taskSubmitted: (kind, f, loop, evi) => `${kind} soumis, style : ${f}. Veuillez consulter les résultats de l'agent ci-dessous.${loop}${evi}`,
    taskKinds: { review: 'revue en lecture seule', loop: 'Loop', 'done-check': 'vérification d’achèvement', evidence: 'vérification de preuves', again: 'demande d’autre approche', activate: 'demande de tâche' },
    loopOracleUser: '\nOracle : commande de vérification définie par l’utilisateur.',
    loopOracleHonor: '\nOracle non configuré, honor system uniquement.',
    gitEvidenceMissing: '\nAucune preuve Git obtenue, vérification en lecture seule demandée à l’agent.',
    commandCanceled: 'La commande PUA a été annulée.',
  },
  de: {
    flavorExample: 'Beispiel: /pua flavor huawei',
    statusText: (enabled, mode, flavor, scope, runtime) => `${enabled ? 'Aktiviert' : 'Deaktiviert'}; Modus: ${mode}; Stil: ${flavor}.\n${scope}; Vollständiger Originaltext 3.5.1.${runtime ? '\n' + runtime : ''}`,
    autoRouting: 'Automatisch geroutet',
    locked: f => `${f} (gesperrt)`,
    noAgents: 'Der Host bietet keinen Unteragenten-Status.',
    agentsFootnote: 'DSH-Agenten werden vom Host verwaltet, ohne Original-PID/TTL-Dateien.',
    reapOrphans: 'DSH bereinigt Schleifen dieses Plugins bei Abbruch, Fehler oder Entladen; keine Hintergrundprozesse zu bereinigen. Andere Tools verwalten ihre eigenen Unteragenten und Worktrees.',
    puaDisallowed: '„PUA zulassen“ ist deaktiviert; diese Sitzung kann nicht aktiviert werden. Bitte @michengai/dsh-pua unter Plugins öffnen und aktivieren.',
    loopRequiresSubprocess: 'Unabhängige Überprüfung erfordert Host-Subprocess und Sitzungsarbeitsverzeichnis; Schleife nicht gestartet.',
    configureSaved: 'Sitzungskonfiguration gespeichert; nicht überschriebene Optionen folgen globalen Vorgaben.',
    loopCanceled: 'Aktueller Loop wurde abgebrochen; es werden keine weiteren Runden ausgeführt.',
    stoppedLoops: n => `${n} von diesem Plugin verwaltete Schleifen wurden beendet; Unteragenten und Worktrees anderer Tools wurden nicht gelöscht.`,
    offline: 'Lokaler Modus aktiv; keine Netzwerkabfrage oder Telemetrie.',
    off: scope => `PUA deaktiviert und Loop abgebrochen. Bereich: ${scope}.`,
    flavorLocked: (f, enabled, scope) => `Gesperrt auf ${f}; Modus ist derzeit ${enabled ? 'aktiviert' : 'deaktiviert'}. Bereich: ${scope}.`,
    flavorAuto: (enabled, scope) => `Automatische Auswahl wiederhergestellt; Modus ist derzeit ${enabled ? 'aktiviert' : 'deaktiviert'}. Bereich: ${scope}.`,
    taskModeEnabled: f => `Aufgabenmodus aktiviert mit Stil: ${f}, wird ab dem nächsten Modellschritt wirksam.`,
    taskSubmitted: (kind, f, loop, evi) => `${kind} übermittelt, Stil: ${f}. Bitte die Ergebnisse des Agenten unten prüfen.${loop}${evi}`,
    taskKinds: { review: 'schreibgeschützte Überprüfung', loop: 'Loop', 'done-check': 'Abschlussprüfung', evidence: 'Belegprüfung', again: 'Anderer-Ansatz-Anforderung', activate: 'Aufgabenanforderung' },
    loopOracleUser: '\nOracle: benutzerdefinierter Prüfbefehl.',
    loopOracleHonor: '\nOracle nicht konfiguriert, nur Honor System.',
    gitEvidenceMissing: '\nKeine Git-Belege ermittelt, Agent um ergänzende schreibgeschützte Prüfung gebeten.',
    commandCanceled: 'PUA-Befehl wurde abgebrochen.',
  },
  ru: {
    flavorExample: 'Пример: /pua flavor huawei',
    statusText: (enabled, mode, flavor, scope, runtime) => `${enabled ? 'Включено' : 'Выключено'}; Режим: ${mode}; Вкус: ${flavor}.\n${scope}; Полный текст 3.5.1.${runtime ? '\n' + runtime : ''}`,
    autoRouting: 'Авто-маршрутизация',
    locked: f => `${f} (зафиксирован)`,
    noAgents: 'Хост не предоставил статус под-агентов.',
    agentsFootnote: 'Агенты DSH управляются хостом, без оригинальных файлов PID/TTL.',
    reapOrphans: 'DSH очищает циклы этого плагина при отмене, ошибке или выгрузке; нет фоновых процессов для очистки. Другие инструменты управляют своими субагентами и worktree.',
    puaDisallowed: '«Разрешить PUA» выключено; эта сессия не может быть включена. Откройте @michengai/dsh-pua в Плагинах и включите разрешение.',
    loopRequiresSubprocess: 'Для независимой проверки требуется subprocess хоста и рабочий каталог сессии; цикл не запущен.',
    configureSaved: 'Настройки сессии сохранены; не переопределённые параметры следуют глобальным.',
    loopCanceled: 'Текущий Loop отменён; дальнейшие раунды выполняться не будут.',
    stoppedLoops: n => `Остановлено ${n} циклов, управляемых этим плагином; субагенты и worktree других инструментов не удалялись.`,
    offline: 'Локальный режим активен; без сетевых обновлений и отправки отчётов.',
    off: scope => `PUA отключён, Loop отменён. Область: ${scope}.`,
    flavorLocked: (f, enabled, scope) => `Зафиксирован ${f}; режим сейчас ${enabled ? 'включён' : 'выключен'}. Область: ${scope}.`,
    flavorAuto: (enabled, scope) => `Авто-маршрутизация восстановлена; режим сейчас ${enabled ? 'включён' : 'выключен'}. Область: ${scope}.`,
    taskModeEnabled: f => `Режим задач включён со вкусом: ${f}, вступает в силу со следующего шага модели.`,
    taskSubmitted: (kind, f, loop, evi) => `Отправлено ${kind}, вкус: ${f}. Ознакомьтесь с результатами работы агента ниже.${loop}${evi}`,
    taskKinds: { review: 'только чтение (ревью)', loop: 'Loop', 'done-check': 'проверка завершения', evidence: 'проверка доказательств', again: 'запрос другого подхода', activate: 'запрос задачи' },
    loopOracleUser: '\nOracle: пользовательская команда проверки.',
    loopOracleHonor: '\nOracle не настроен, только honor system.',
    gitEvidenceMissing: '\nДоказательства Git не получены, агенту предписано дополнить проверкой.',
    commandCanceled: 'Команда PUA была отменена.',
  },
  pt: {
    flavorExample: 'Exemplo: /pua flavor huawei',
    statusText: (enabled, mode, flavor, scope, runtime) => `${enabled ? 'Ativado' : 'Desativado'}; Modo: ${mode}; Estilo: ${flavor}.\n${scope}; Texto original 3.5.1 completo.${runtime ? '\n' + runtime : ''}`,
    autoRouting: 'Roteamento automático',
    locked: f => `${f} (bloqueado)`,
    noAgents: 'O host não fornece o status dos subagentes.',
    agentsFootnote: 'Os agentes DSH são gerenciados pelo host, sem arquivos PID/TTL originais.',
    reapOrphans: 'O DSH limpa os loops deste plugin ao cancelar, falhar ou descarregar; sem processos em segundo plano para limpar. Outras ferramentas gerenciam seus próprios subagentes e worktrees.',
    puaDisallowed: '«Permitir PUA» está desativado; esta sessão não pode ser ligada. Abra @michengai/dsh-pua em Plugins e ative-o primeiro.',
    loopRequiresSubprocess: 'A verificação independente requer subprocess do host e diretório de trabalho; loop não iniciado.',
    configureSaved: 'Configuração da sessão salva; opções não modificadas continuam seguindo os padrões globais.',
    loopCanceled: 'O Loop atual foi cancelado; nenhuma rodada adicional será executada.',
    stoppedLoops: n => `${n} loops gerenciados por este plugin foram interrompidos; subagentes e worktrees de outras ferramentas não foram removidos.`,
    offline: 'Modo local ativo; sem atualizações de rede ou telemetria.',
    off: scope => `PUA desativado e Loop cancelado. Escopo: ${scope}.`,
    flavorLocked: (f, enabled, scope) => `Fixado em ${f}; o modo está ${enabled ? 'ativado' : 'desativado'}. Escopo: ${scope}.`,
    flavorAuto: (enabled, scope) => `Roteamento automático restaurado; o modo está ${enabled ? 'ativado' : 'desativado'}. Escopo: ${scope}.`,
    taskModeEnabled: f => `Modo de tarefa ativado com estilo: ${f}, vigora a partir da próxima etapa do modelo.`,
    taskSubmitted: (kind, f, loop, evi) => `${kind} enviado, estilo: ${f}. Verifique os resultados do agente abaixo.${loop}${evi}`,
    taskKinds: { review: 'revisão somente leitura', loop: 'Loop', 'done-check': 'verificação de conclusão', evidence: 'verificação de evidências', again: 'solicitação de outra abordagem', activate: 'solicitação de tarefa' },
    loopOracleUser: '\nOracle: comando de verificação especificado pelo usuário.',
    loopOracleHonor: '\nOracle não configurado, apenas honor system.',
    gitEvidenceMissing: '\nNenhuma evidência Git obtida, solicitado ao agente validação complementar.',
    commandCanceled: 'O comando PUA foi cancelado.',
  },
};

export interface ArgsCopy {
  inputTooLong: string;
  invalidControlChar: string;
  singlePrefix: string;
  invalidJson: string;
  unknownConfigKey: string;
  taskRequiredAfterDashDash: string;
  unsupportedOption: string;
  unknownFlavor: string;
  didYouMean: (typo: string, input: string) => string;
  noExtraArgs: (command: string) => string;
  loopQuotesInvalid: string;
  maxIterationsDuplicate: string;
  maxIterationsInvalid: string;
  verifyDuplicate: string;
  verifyQuotedRequired: string;
  verifyNotEmpty: string;
  unsupportedLoopOption: (token: string) => string;
  loopTaskRequired: string;
  unrecognizedKeys: (keys: string[]) => string;
  invalidConfigParam: string;
}

export const ARGS_COPY: Record<UiLang, ArgsCopy> = {
  zh: {
    inputTooLong: '输入超过长度限制，请缩短任务或验收命令。',
    invalidControlChar: '输入包含不支持的控制字符。',
    singlePrefix: '请只输入一次 /pua 前缀，例如 /pua flavor。',
    invalidJson: '配置 JSON 格式无效，请检查引号、逗号和括号。',
    unknownConfigKey: '未知配置项。',
    taskRequiredAfterDashDash: '-- 后需要任务描述。',
    unsupportedOption: '不支持此选项。输入 /pua help 查看用法。',
    unknownFlavor: '未知风味。输入 /pua flavor 查看可用名称。',
    didYouMean: (typo, input) => `可能想输入 /pua ${typo}。若确实要把原文作为任务，请使用 /pua -- ${input}。`,
    noExtraArgs: cmd => `${cmd} 不接受额外参数；任务以此单词开头时请使用 /pua -- 任务描述。`,
    loopQuotesInvalid: 'Loop 参数引号未闭合或格式无效，请将任务和完整验证命令分别放在引号中。',
    maxIterationsDuplicate: '--max-iterations 不能重复。',
    maxIterationsInvalid: '--max-iterations 必须为 0–10000；0 表示按原版不限轮次。',
    verifyDuplicate: '--verify 不能重复。',
    verifyQuotedRequired: '--verify 后需要带引号的验证命令。',
    verifyNotEmpty: '验证命令不能为空。',
    unsupportedLoopOption: token => `不支持循环选项：${token}`,
    loopTaskRequired: 'loop 需要任务描述，例如 /pua loop "修复测试" --verify "npm test" --max-iterations 10。',
    unrecognizedKeys: keys => `未知配置项：${keys.join(', ')}`,
    invalidConfigParam: '配置参数格式或类型无效。',
  },
  en: {
    inputTooLong: 'Input exceeds length limit. Please shorten the task or verify command.',
    invalidControlChar: 'Input contains unsupported control characters.',
    singlePrefix: 'Please enter the /pua prefix only once, e.g. /pua flavor.',
    invalidJson: 'Invalid configuration JSON. Please check quotes, commas, and brackets.',
    unknownConfigKey: 'Unknown configuration key.',
    taskRequiredAfterDashDash: 'Task description required after --.',
    unsupportedOption: 'Unsupported option. Type /pua help to view usage.',
    unknownFlavor: 'Unknown flavor. Type /pua flavor to view available names.',
    didYouMean: (typo, input) => `Did you mean /pua ${typo}? To use the raw text as a task, use /pua -- ${input}.`,
    noExtraArgs: cmd => `${cmd} takes no extra arguments. If your task starts with this keyword, use /pua -- <task>.`,
    loopQuotesInvalid: 'Loop parameters have unclosed quotes or invalid syntax. Please enclose task and verify command in quotes.',
    maxIterationsDuplicate: '--max-iterations cannot be repeated.',
    maxIterationsInvalid: '--max-iterations must be an integer between 0 and 10000; 0 means unlimited.',
    verifyDuplicate: '--verify cannot be repeated.',
    verifyQuotedRequired: '--verify requires a quoted verification command.',
    verifyNotEmpty: 'Verification command cannot be empty.',
    unsupportedLoopOption: token => `Unsupported loop option: ${token}`,
    loopTaskRequired: 'loop requires a task description, e.g. /pua loop "fix tests" --verify "npm test" --max-iterations 10.',
    unrecognizedKeys: keys => `Unrecognized configuration option(s): ${keys.join(', ')}`,
    invalidConfigParam: 'Invalid configuration parameter format or type.',
  },
  ja: {
    inputTooLong: '入力が長さ制限を超えています。タスクまたは検証コマンドを短縮してください。',
    invalidControlChar: '入力にサポートされていない制御文字が含まれています。',
    singlePrefix: '/pua プレフィックスは一度だけ入力してください（例：/pua flavor）。',
    invalidJson: '設定 JSON の形式が無効です。引用符、カンマ、括弧を確認してください。',
    unknownConfigKey: '未定義の設定項目です。',
    taskRequiredAfterDashDash: '-- の後にはタスクの説明が必要です。',
    unsupportedOption: 'サポートされていないオプションです。/pua help で使い方を確認してください。',
    unknownFlavor: '未知のスタイルです。/pua flavor で利用可能な一覧を確認してください。',
    didYouMean: (typo, input) => `/pua ${typo} を意図していましたか？原文をタスクとして実行するには /pua -- ${input} を使用してください。`,
    noExtraArgs: cmd => `${cmd} には追加パラメータを渡せません。タスクがこの単語で始まる場合は /pua -- <タスク> を使用してください。`,
    loopQuotesInvalid: 'Loop パラメータの引用符が閉じていないか形式が無効です。タスクと検証コマンドをそれぞれ引用符で囲んでください。',
    maxIterationsDuplicate: '--max-iterations は重複指定できません。',
    maxIterationsInvalid: '--max-iterations は 0〜10000 の整数である必要があります（0 は無制限）。',
    verifyDuplicate: '--verify は重複指定できません。',
    verifyQuotedRequired: '--verify の後には引用符で囲んだ検証コマンドが必要です。',
    verifyNotEmpty: '検証コマンドを空にすることはできません。',
    unsupportedLoopOption: token => `サポートされていないループオプション：${token}`,
    loopTaskRequired: 'loop にはタスク説明が必要です（例：/pua loop "テスト修正" --verify "npm test" --max-iterations 10）。',
    unrecognizedKeys: keys => `未定義の設定項目：${keys.join(', ')}`,
    invalidConfigParam: '設定パラメータの形式または型が無効です。',
  },
  es: {
    inputTooLong: 'La entrada supera el límite de longitud. Acorta la tarea o el comando de verificación.',
    invalidControlChar: 'La entrada contiene caracteres de control no compatibles.',
    singlePrefix: 'Introduce el prefijo /pua solo una vez, ej. /pua flavor.',
    invalidJson: 'JSON de configuración no válido. Revisa las comillas, comas y llaves.',
    unknownConfigKey: 'Opción de configuración desconocida.',
    taskRequiredAfterDashDash: 'Se requiere una descripción de tarea tras --.',
    unsupportedOption: 'Opción no compatible. Escribe /pua help para ver el uso.',
    unknownFlavor: 'Sabor desconocido. Escribe /pua flavor para ver los nombres disponibles.',
    didYouMean: (typo, input) => `¿Quizás quisiste decir /pua ${typo}? Para usar el texto como tarea, escribe /pua -- ${input}.`,
    noExtraArgs: cmd => `${cmd} no acepta argumentos adicionales; si la tarea empieza con esta palabra, usa /pua -- <tarea>.`,
    loopQuotesInvalid: 'Comillas sin cerrar o formato no válido en parámetros de Loop. Pon la tarea y el comando entre comillas.',
    maxIterationsDuplicate: '--max-iterations no puede repetirse.',
    maxIterationsInvalid: '--max-iterations debe ser un entero entre 0 y 10000; 0 significa sin límite.',
    verifyDuplicate: '--verify no puede repetirse.',
    verifyQuotedRequired: '--verify requiere un comando de verificación entre comillas.',
    verifyNotEmpty: 'El comando de verificación no puede estar vacío.',
    unsupportedLoopOption: token => `Opción de bucle no admitida: ${token}`,
    loopTaskRequired: 'loop requiere una descripción de tarea, ej. /pua loop "corregir tests" --verify "npm test" --max-iterations 10.',
    unrecognizedKeys: keys => `Opciones de configuración no reconocidas: ${keys.join(', ')}`,
    invalidConfigParam: 'Formato o tipo de parámetro de configuración no válido.',
  },
  fr: {
    inputTooLong: 'L’entrée dépasse la limite de longueur. Veuillez raccourcir la tâche ou la commande de vérification.',
    invalidControlChar: 'L’entrée contient des caractères de contrôle non pris en charge.',
    singlePrefix: 'Veuillez saisir le préfixe /pua une seule fois, par ex. /pua flavor.',
    invalidJson: 'Format JSON de configuration invalide. Vérifiez les guillemets, virgules et parenthèses.',
    unknownConfigKey: 'Clé de configuration inconnue.',
    taskRequiredAfterDashDash: 'Description de tâche requise après --.',
    unsupportedOption: 'Option non prise en charge. Tapez /pua help pour voir l’utilisation.',
    unknownFlavor: 'Style inconnu. Tapez /pua flavor pour afficher la liste disponible.',
    didYouMean: (typo, input) => `Vouliez-vous dire /pua ${typo} ? Pour traiter le texte comme une tâche, utilisez /pua -- ${input}.`,
    noExtraArgs: cmd => `${cmd} n’accepte aucun argument supplémentaire ; si la tâche commence par ce mot, utilisez /pua -- <tâche>.`,
    loopQuotesInvalid: 'Guillemets non fermés ou format invalide dans les paramètres du Loop. Mettez la tâche et la commande entre guillemets.',
    maxIterationsDuplicate: '--max-iterations ne peut pas être répété.',
    maxIterationsInvalid: '--max-iterations doit être un entier entre 0 et 10000 ; 0 signifie illimité.',
    verifyDuplicate: '--verify ne peut pas être répété.',
    verifyQuotedRequired: '--verify nécessite une commande de vérification entre guillemets.',
    verifyNotEmpty: 'La commande de vérification ne peut pas être vide.',
    unsupportedLoopOption: token => `Option de boucle non prise en charge : ${token}`,
    loopTaskRequired: 'loop nécessite une description de tâche, par ex. /pua loop "corriger tests" --verify "npm test" --max-iterations 10.',
    unrecognizedKeys: keys => `Option(s) de configuration non reconnue(s) : ${keys.join(', ')}`,
    invalidConfigParam: 'Format ou type de paramètre de configuration invalide.',
  },
  de: {
    inputTooLong: 'Eingabe überschreitet das Längenlimit. Bitte Aufgabe oder Prüfbefehl kürzen.',
    invalidControlChar: 'Eingabe enthält nicht unterstützte Steuerzeichen.',
    singlePrefix: 'Bitte das Präfix /pua nur einmal eingeben, z. B. /pua flavor.',
    invalidJson: 'Ungültiges JSON-Format. Bitte Anführungszeichen, Kommas und Klammern prüfen.',
    unknownConfigKey: 'Unbekannter Konfigurationsschlüssel.',
    taskRequiredAfterDashDash: 'Nach -- ist eine Aufgabenbeschreibung erforderlich.',
    unsupportedOption: 'Nicht unterstützte Option. /pua help eingeben, um die Hilfe anzuzeigen.',
    unknownFlavor: 'Unbekannter Stil. /pua flavor eingeben, um verfügbare Namen anzuzeigen.',
    didYouMean: (typo, input) => `Meinten Sie /pua ${typo}? Verwenden Sie /pua -- ${input}, um den Text als Aufgabe auszuführen.`,
    noExtraArgs: cmd => `${cmd} akzeptiert keine zusätzlichen Argumente; beginnt die Aufgabe mit diesem Wort, bitte /pua -- <Aufgabe> nutzen.`,
    loopQuotesInvalid: 'Unvollständige Anführungszeichen oder ungültiges Format in Loop-Parametern. Aufgabe und Prüfbefehl in Anführungszeichen setzen.',
    maxIterationsDuplicate: '--max-iterations darf nicht wiederholt werden.',
    maxIterationsInvalid: '--max-iterations muss eine Ganzzahl von 0 bis 10000 sein; 0 bedeutet unbegrenzt.',
    verifyDuplicate: '--verify darf nicht wiederholt werden.',
    verifyQuotedRequired: '--verify erfordert einen Prüfbefehl in Anführungszeichen.',
    verifyNotEmpty: 'Prüfbefehl darf nicht leer sein.',
    unsupportedLoopOption: token => `Nicht unterstützte Schleifen-Option: ${token}`,
    loopTaskRequired: 'loop erfordert eine Aufgabenbeschreibung, z. B. /pua loop "Tests reparieren" --verify "npm test" --max-iterations 10.',
    unrecognizedKeys: keys => `Unbekannte Konfigurationsoption(en): ${keys.join(', ')}`,
    invalidConfigParam: 'Ungültiges Format oder Typ des Konfigurationsparameters.',
  },
  ru: {
    inputTooLong: 'Ввод превышает ограничение по длине. Сократите задачу или команду проверки.',
    invalidControlChar: 'Ввод содержит неподдерживаемые управляющие символы.',
    singlePrefix: 'Пожалуйста, укажите префикс /pua только один раз, например: /pua flavor.',
    invalidJson: 'Недопустимый формат JSON. Проверьте кавычки, запятые и скобки.',
    unknownConfigKey: 'Неизвестный ключ конфигурации.',
    taskRequiredAfterDashDash: 'После -- требуется описание задачи.',
    unsupportedOption: 'Неподдерживаемая опция. Введите /pua help для справки.',
    unknownFlavor: 'Неизвестный вкус. Введите /pua flavor, чтобы посмотреть доступные варианты.',
    didYouMean: (typo, input) => `Возможно, имелось в виду /pua ${typo}? Чтобы использовать текст как задачу, введите /pua -- ${input}.`,
    noExtraArgs: cmd => `${cmd} не принимает дополнительных аргументов; если задача начинается с этого слова, используйте /pua -- <задача>.`,
    loopQuotesInvalid: 'Незакрытые кавычки или недопустимый формат в параметрах Loop. Заключите задачу и команду в кавычки.',
    maxIterationsDuplicate: '--max-iterations не может повторяться.',
    maxIterationsInvalid: '--max-iterations должно быть целым числом от 0 до 10000; 0 означает без ограничений.',
    verifyDuplicate: '--verify не может повторяться.',
    verifyQuotedRequired: '--verify требует команду проверки в кавычках.',
    verifyNotEmpty: 'Команда проверки не может быть пустой.',
    unsupportedLoopOption: token => `Неподдерживаемая опция цикла: ${token}`,
    loopTaskRequired: 'loop требует описание задачи, напр. /pua loop "исправить тесты" --verify "npm test" --max-iterations 10.',
    unrecognizedKeys: keys => `Неизвестные параметры конфигурации: ${keys.join(', ')}`,
    invalidConfigParam: 'Недопустимый формат или тип параметра конфигурации.',
  },
  pt: {
    inputTooLong: 'A entrada excede o limite de comprimento. Encurte a tarefa ou o comando de verificação.',
    invalidControlChar: 'A entrada contém caracteres de controle não suportados.',
    singlePrefix: 'Por favor, insira o prefixo /pua apenas uma vez, ex: /pua flavor.',
    invalidJson: 'Formato JSON de configuração inválido. Verifique aspas, vírgulas e colchetes.',
    unknownConfigKey: 'Chave de configuração desconhecida.',
    taskRequiredAfterDashDash: 'É necessária uma descrição de tarefa após --.',
    unsupportedOption: 'Opção não suportada. Digite /pua help para ver o uso.',
    unknownFlavor: 'Estilo desconhecido. Digite /pua flavor para ver os nomes disponíveis.',
    didYouMean: (typo, input) => `Você quis dizer /pua ${typo}? Para usar o texto como tarefa, use /pua -- ${input}.`,
    noExtraArgs: cmd => `${cmd} não aceita argumentos adicionais; se a tarefa começar com esta palavra, use /pua -- <tarefa>.`,
    loopQuotesInvalid: 'Aspas não fechadas ou formato inválido nos parâmetros do Loop. Coloque a tarefa e o comando entre aspas.',
    maxIterationsDuplicate: '--max-iterations não pode ser repetido.',
    maxIterationsInvalid: '--max-iterations deve ser um número inteiro de 0 a 10000; 0 significa ilimitado.',
    verifyDuplicate: '--verify não pode ser repetido.',
    verifyQuotedRequired: '--verify requer um comando de verificação entre aspas.',
    verifyNotEmpty: 'O comando de verificação não pode estar vazio.',
    unsupportedLoopOption: token => `Opção de loop não suportada: ${token}`,
    loopTaskRequired: 'loop requer uma descrição de tarefa, ex: /pua loop "corrigir testes" --verify "npm test" --max-iterations 10.',
    unrecognizedKeys: keys => `Opções de configuração não reconhecidas: ${keys.join(', ')}`,
    invalidConfigParam: 'Formato ou tipo de parâmetro de configuração inválido.',
  },
};

/** 人性化格式化错误信息（含 ZodError、未知配置项及各语言映射）。 */
export function formatErrorMessage(error: unknown, lang: UiLang = 'zh'): string {
  const text = error instanceof Error ? error.message : String(error);
  const copy = ARGS_COPY[lang] ?? ARGS_COPY.zh;
  try {
    if (text.startsWith('[') && text.endsWith(']')) {
      const issues = JSON.parse(text) as { code?: string; keys?: string[]; path?: string[] }[];
      if (Array.isArray(issues) && issues.length > 0) {
        const unrecognized = issues.find(i => i.code === 'unrecognized_keys');
        if (unrecognized?.keys && unrecognized.keys.length > 0) {
          return copy.unrecognizedKeys(unrecognized.keys);
        }
        return copy.invalidConfigParam;
      }
    }
  } catch {
    /* 忽略 JSON 解析异常，继续向下查找 */
  }
  return text;
}
