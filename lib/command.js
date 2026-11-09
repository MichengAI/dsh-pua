import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { parseArgs } from './args.js';
import { StateStore } from './state.js';
import { collectGitEvidence, REVIEW_RULES } from './review.js';
import { SourceCatalog } from './source.js';
import { LOOP_START } from './runtime.js';
import { COMMAND_PLUGIN, pluginSource } from './message-source.js';
import { COMMAND_COPY, flavorLabel, formatErrorMessage, hostLocaleOf, localizedListFlavors, resolveUiLang, sessionResultPrefix, } from './i18n.js';
import { modeName } from './display.js';
export const HELP_TEXTS = {
    zh: `用法：
/pua [任务描述]：开启 PUA；无描述时继续当前任务
/pua review [范围]：只读审查，附带当前仓库 Git 索引证据（宿主可用时）
/pua on / /pua off：只修改当前会话；不改变全局默认、不发起模型请求
/pua config {"subagents":true}：修改当前会话参数
/pua reset [参数名]：恢复单项或全部跟随全局
/pua flavor [名称|auto]：列出（或用 /pua flavors）、锁定或恢复自动选味，不自动开启
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [任务]：完整原版模式
/pua ding [任务]：钉内/钉外味
/pua loop "任务" --verify "npm test" --max-iterations 10：独立验收循环；省略参数使用当前会话生效默认值
/pua cancel-loop 或 /pua-cancel-loop：取消当前循环
/pua kpi / /pua survey [quick]：原版 KPI 与本地问卷
/pua offline：保持本地模式，无上传能力
/pua team-status：当前会话及其 DSH 子代理状态
/pua reap-orphans / /pua teardown-all：回收本插件循环；不删除其他工具管理的 worktree
/pua again：针对当前目标换一种实质不同的方法
/pua done-check：核对需求、交付结果、验收证据和缺口
/pua evidence：核对已存在证据，指出未证明的结论
/pua status：查看当前配置
/pua -- 任务描述：任务以控制命令同名单词开头时使用
原版冒号命令对应 DSH 空格子命令，例如 /pua:p9 → /pua p9。
全局开关在「插件」中打开「允许使用 PUA」修改，只控制命令和聊天入口，不自动注入。设置命名空间：michengai-pua。无 settings 时降级为当前会话，默认关闭。`,
    en: `Usage:
/pua [task]: Enable PUA; without description, continue current task
/pua review [scope]: Read-only review with Git index evidence (when host available)
/pua on / /pua off: Modify current session only; does not change global defaults or invoke model
/pua config {"subagents":true}: Modify current session parameters
/pua reset [key]: Restore individual or all options to global defaults
/pua flavor [name|auto]: List (or use /pua flavors), lock, or restore auto flavor routing
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [task]: Full persona mode
/pua ding [task]: DingTalk flavor
/pua loop "task" --verify "npm test" --max-iterations 10: Independent verification loop
/pua cancel-loop or /pua-cancel-loop: Cancel current verification loop
/pua kpi / /pua survey [quick]: Original KPI and local survey
/pua offline: Local mode, no uploading
/pua team-status: Status of current session and DSH subagents
/pua reap-orphans / /pua teardown-all: Clean up loops managed by this plugin
/pua again: Try a substantially different approach for current goal
/pua done-check: Check requirements, delivered results, verification evidence, and gaps
/pua evidence: Verify existing evidence and point out unproven claims
/pua status: View current configuration
/pua -- task: Use when task starts with a control command keyword
Colon commands map to DSH subcommands, e.g. /pua:p9 -> /pua p9.
Global switch is configured in Plugins -> Allow PUA. It only controls command and chat entry visibility without auto-injection. Namespace: michengai-pua. Falls back to current session only and off by default when settings service is unavailable.`,
    ja: `使い方：
/pua [タスク説明]：PUA を有効化。説明省略時は現在のタスクを継続
/pua review [範囲]：読み取り専用レビュー（Git インデックス証拠付き）
/pua on / /pua off：現在のセッションのみ変更。グローバル設定やモデル呼び出しは行いません
/pua config {"subagents":true}：現在のセッションパラメータを変更
/pua reset [設定名]：単一項目または全項目をグローバル設定に戻す
/pua flavor [名前|auto]：スタイルの一覧表示（または /pua flavors）、固定、または自動選択の復元
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [タスク]：フルペルソナモード
/pua ding [タスク]：DingTalk スタイル
/pua loop "タスク" --verify "npm test" --max-iterations 10：独立検証ループの開始
/pua cancel-loop または /pua-cancel-loop：現在のループをキャンセル
/pua kpi / /pua survey [quick]：KPI レポートおよびローカルアンケート
/pua offline：ローカルモードを維持（外部送信なし）
/pua team-status：現在のセッションおよび DSH サブエージェントの状態
/pua reap-orphans / /pua teardown-all：本プラグインが管理するループを回収
/pua again：現在のアプローチと根本的に異なる方法を再試行
/pua done-check：要件、成果物、検証証拠、未解決のギャップを照合
/pua evidence：既存の証拠を検証し未証明の主張を指摘
/pua status：現在の設定を確認
/pua -- タスク説明：制御コマンドと同名の単語で始まるタスクに使用
コロンコマンドは DSH サブコマンドに対応します（例：/pua:p9 → /pua p9）。
グローバル設定はサイドバー「プラグイン」内の「PUA の使用を許可」から変更します。Namespace: michengai-pua。settings サービスが利用できない場合は現在のセッションに縮退し、デフォルトで無効です。`,
    es: `Uso:
/pua [tarea]: Activar PUA; sin descripción continúa la tarea actual
/pua review [alcance]: Revisión de solo lectura con evidencias de Git
/pua on / /pua off: Modifica solo la sesión actual; no cambia valores globales ni llama al modelo
/pua config {"subagents":true}: Modifica los parámetros de la sesión actual
/pua reset [clave]: Restablece una opción o todas al valor global
/pua flavor [nombre|auto]: Lista (o usa /pua flavors), fija o restaura la selección automática de sabor
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [tarea]: Modo de rol completo
/pua ding [tarea]: Sabor DingTalk
/pua loop "tarea" --verify "npm test" --max-iterations 10: Bucle de verificación independiente
/pua cancel-loop o /pua-cancel-loop: Cancela el bucle actual
/pua kpi / /pua survey [quick]: KPI y encuesta local original
/pua offline: Modo local sin subida a la red
/pua team-status: Estado de la sesión actual y subagentes de DSH
/pua reap-orphans / /pua teardown-all: Recupera y limpia los bucles gestionados por este plugin
/pua again: Prueba un enfoque sustancialmente diferente para el objetivo actual
/pua done-check: Verifica requisitos, entregas, evidencias y discrepancias
/pua evidence: Comprueba evidencias existentes y señala afirmaciones sin probar
/pua status: Muestra la configuración actual
/pua -- tarea: Usar cuando la tarea comience con una palabra reservada de comando
Los comandos con dos puntos equivalen a subcomandos de DSH (ej.: /pua:p9 -> /pua p9).
El interruptor global se configura en «Complementos -> Permitir PUA». Espacio de nombres: michengai-pua. Sin servicio de settings, se degrada a la sesión actual y queda desactivado por defecto.`,
    fr: `Utilisation :
/pua [tâche] : Activer PUA ; sans description, poursuit la tâche active
/pua review [périmètre] : Revue en lecture seule avec preuves de l'index Git
/pua on / /pua off : Modifie la session courante uniquement ; ne change pas les réglages globaux
/pua config {"subagents":true} : Modifie les paramètres de la session active
/pua reset [clé] : Rétablit une ou toutes les options aux valeurs par défaut globales
/pua flavor [nom|auto] : Liste (ou utilisez /pua flavors), verrouille ou rétablit le choix automatique de style
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [tâche] : Mode de rôle complet
/pua ding [tâche] : Style DingTalk
/pua loop "tâche" --verify "npm test" --max-iterations 10 : Boucle de vérification indépendante
/pua cancel-loop ou /pua-cancel-loop : Annule la boucle active
/pua kpi / /pua survey [quick] : KPI et questionnaire local d'origine
/pua offline : Mode local sans téléversement
/pua team-status : État de la session courante et des sous-agents DSH
/pua reap-orphans / /pua teardown-all : Nettoie les boucles gérées par cette extension
/pua again : Tente une approche substantiellement différente pour l'objectif en cours
/pua done-check : Vérifie exigences, livrables, preuves de validation et manques
/pua evidence : Vérifie les preuves existantes et signale les affirmations non prouvées
/pua status : Affiche la configuration courante
/pua -- tâche : À utiliser si la tâche commence par un nom de commande
Les commandes avec deux-points correspondent aux sous-commandes DSH (ex : /pua:p9 -> /pua p9).
L'interrupteur global se règle dans « Extensions -> Autoriser PUA ». Espace de noms : michengai-pua. En l'absence de service de paramètres, se limite à la session active et est désactivé par défaut.`,
    de: `Verwendung:
/pua [Aufgabe]: PUA aktivieren; ohne Beschreibung wird die aktuelle Aufgabe fortgesetzt
/pua review [Bereich]: Schreibgeschützte Überprüfung mit Git-Index-Belegen
/pua on / /pua off: Nur aktuelle Sitzung ändern; ändert keine globalen Vorgaben
/pua config {"subagents":true}: Parameter der aktuellen Sitzung ändern
/pua reset [Schlüssel]: Einzelne Option oder alles auf globale Vorgaben zurücksetzen
/pua flavor [Name|auto]: Stile auflisten (oder /pua flavors verwenden), sperren oder automatische Auswahl wiederherstellen
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [Aufgabe]: Vollständiger Rollenmodus
/pua ding [Aufgabe]: DingTalk-Stil
/pua loop "Aufgabe" --verify "npm test" --max-iterations 10: Unabhängige Prüfschleife
/pua cancel-loop oder /pua-cancel-loop: Aktuelle Prüfschleife abbrechen
/pua kpi / /pua survey [quick]: KPI-Bericht und lokale Umfrage
/pua offline: Lokaler Modus ohne Netzwerk-Upload
/pua team-status: Status der aktuellen Sitzung und DSH-Unteragenten
/pua reap-orphans / /pua teardown-all: Von diesem Plugin verwaltete Schleifen bereinigen
/pua again: Einen grundlegend anderen Ansatz für das aktuelle Ziel versuchen
/pua done-check: Anforderungen, Ergebnisse, Abnahmebelege und Lücken abgleichen
/pua evidence: Vorhandene Belege prüfen und unbewiesene Behauptungen aufzeigen
/pua status: Aktuelle Konfiguration anzeigen
/pua -- Aufgabe: Verwenden, wenn die Aufgabe mit einem Befehlswort beginnt
Doppelpunkt-Befehle entsprechen DSH-Unterbefehlen (z. B. /pua:p9 -> /pua p9).
Der globale Schalter wird unter «Plugins -> PUA zulassen» konfiguriert. Namespace: michengai-pua. Ohne Einstellungsdienst wird auf die aktuelle Sitzung zurückgefallen, standardmäßig deaktiviert.`,
    ru: `Использование:
/pua [задача]: Включить PUA; без описания продолжает текущую задачу
/pua review [область]: Только чтение с доказательствами из индекса Git
/pua on / /pua off: Изменить только текущую сессию; не меняет глобальные значения
/pua config {"subagents":true}: Изменить параметры текущей сессии
/pua reset [ключ]: Сбросить один или все параметры к глобальным настройкам
/pua flavor [имя|auto]: Список (или используйте /pua flavors), фиксация или возврат к автовыбору вкуса
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [задача]: Полный режим роли
/pua ding [задача]: Стиль DingTalk
/pua loop "задача" --verify "npm test" --max-iterations 10: Независимый цикл проверки
/pua cancel-loop или /pua-cancel-loop: Отменить текущий цикл проверки
/pua kpi / /pua survey [quick]: Оригинальный KPI и локальный опрос
/pua offline: Локальный режим, без отправки в сеть
/pua team-status: Статус текущей сессии и под-агентов DSH
/pua reap-orphans / /pua teardown-all: Очистить циклы, управляемые этим плагином
/pua again: Попробовать принципиально другой подход к текущей цели
/pua done-check: Сверить требования, результаты, доказательства и пробелы
/pua evidence: Проверить доказательства и указать на недоказанные утверждения
/pua status: Посмотреть текущую конфигурацию
/pua -- задача: Использовать, если задача начинается с ключевого слова команды
Команды с двоеточием соответствуют подкомандам DSH (напр., /pua:p9 -> /pua p9).
Глобальный переключатель настраивается в «Плагины -> Разрешить PUA». Namespace: michengai-pua. При отсутствии службы настроек откатывается к текущей сессии и выключено по умолчанию.`,
    pt: `Uso:
/pua [tarefa]: Ativar PUA; sem descrição continua a tarefa atual
/pua review [escopo]: Revisão somente leitura com evidências do índice Git
/pua on / /pua off: Modifica apenas a sessão atual; não altera padrões globais
/pua config {"subagents":true}: Modifica parâmetros da sessão atual
/pua reset [chave]: Restaura uma opção ou todas para os padrões globais
/pua flavor [nome|auto]: Lista (ou use /pua flavors), fixa ou restaura a seleção automática de estilo
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [tarefa]: Modo de papel completo
/pua ding [tarefa]: Estilo DingTalk
/pua loop "tarefa" --verify "npm test" --max-iterations 10: Ciclo de verificação independente
/pua cancel-loop ou /pua-cancel-loop: Cancela o ciclo de verificação atual
/pua kpi / /pua survey [quick]: KPI e pesquisa local original
/pua offline: Modo local sem envio para a rede
/pua team-status: Status da sessão atual e subagentes DSH
/pua reap-orphans / /pua teardown-all: Limpa ciclos gerenciados por este plugin
/pua again: Tenta uma abordagem substancialmente diferente para o objetivo atual
/pua done-check: Confere requisitos, entregas, evidências e lacunas
/pua evidence: Verifica evidências existentes e aponta alegações não provadas
/pua status: Exibe a configuração atual
/pua -- tarefa: Use se a tarefa começar com uma palavra reservada de comando
Comandos com dois-pontos mapeiam para subcomandos DSH (ex: /pua:p9 -> /pua p9).
O interruptor global é configurado em «Plugins -> Permitir PUA». Namespace: michengai-pua. Sem o serviço de configurações, limita-se à sessão atual e fica desativado por padrão.`,
};
export const HELP = HELP_TEXTS.zh;
const ENABLING = new Set(['on', 'activate', 'review', 'mode', 'loop', 'again', 'done-check', 'evidence', 'kpi', 'survey']);
function enablesPua(action) {
    return ENABLING.has(action.kind) || (action.kind === 'configure' && action.patch.enabled === true);
}
function actionPrompt(action, templates, catalog) {
    switch (action.kind) {
        case 'activate':
            return action.task ? `请处理下面用户指定的任务。任务正文：\n\n${action.task}`
                : '继续当前已授权任务：先核对目标和现有证据，诊断后完成剩余工作。若历史没有可识别任务，请用户提供目标，不自行编造任务。';
        case 'review':
            return `${REVIEW_RULES}\n\n用户审查范围：${action.task}`;
        case 'again':
        case 'done-check':
        case 'evidence':
            return templates.get(action.kind) + (action.task ? `\n\n用户补充：${action.task}` : '');
        case 'mode':
            return `执行当前 ${action.mode} 完整原版模式。\n${action.task || '继续当前已授权任务；历史无任务时请用户提供目标。'}`;
        case 'loop':
            return `按当前系统中的完整 PUA Loop 协议执行任务：${action.task}\n本轮上限：${action.maxIterations || '无限'}；${action.verify ? 'Oracle 使用用户指定命令独立验证。' : '未配置 Oracle，使用 honor system，不得声称独立验收通过。'}配置已由 DSH 接管，不运行 setup shell 脚本。`;
        case 'kpi':
            return catalog.body('commands/kpi.md') + '\n\n当前 pro 原版协议已完整注入；只基于实际证据生成报告卡，不编造历史。';
        case 'survey':
            return catalog.body('commands/survey.md') + '\n\n参数：' + (action.task ?? '') + (action.task === 'quick' ? '' : '\n\n' + catalog.body('skills/pua/references/survey.md'));
        default:
            return undefined;
    }
}
/** 执行原生命令；投递失败撤销临时状态，成功状态由宿主 command/done 日志恢复。 */
export async function handleCommand(store, invocation, templates, subprocess, services) {
    const { agent, signal, commandId } = invocation;
    let lang = 'zh';
    try {
        signal.throwIfAborted();
        const config = store.configuration(agent.session);
        lang = resolveUiLang(config.language, services?.ctx ? hostLocaleOf(services.ctx) : undefined);
        const action = parseArgs(invocation.rawInput, config, lang);
        const copy = COMMAND_COPY[lang] ?? COMMAND_COPY.zh;
        const prefix = sessionResultPrefix(lang);
        if (action.kind === 'help') {
            const helpText = HELP_TEXTS[lang] ?? HELP_TEXTS.zh;
            return { kind: 'success', text: prefix + helpText };
        }
        if (action.kind === 'flavors') {
            return { kind: 'success', text: prefix + localizedListFlavors(lang) + '\n' + copy.flavorExample };
        }
        if (action.kind === 'status') {
            const state = store.read(agent.session);
            const mode = modeName(services?.runtime?.effectiveMode(agent.session, state.mode) ?? state.mode, lang);
            const flavor = state.flavorLocked ? copy.locked(flavorLabel(state.flavor, lang)) : copy.autoRouting;
            const scope = services?.preferences?.description(lang) ?? (lang === 'zh' ? '当前会话' : 'Current session');
            return {
                kind: 'success',
                text: prefix + copy.statusText(state.enabled, mode, flavor, scope, services?.runtime?.status(agent.session) ?? ''),
            };
        }
        if (action.kind === 'team-status') {
            const agents = services?.ctx?.get('agents')?.list().filter(item => item.id === agent.id || item.session.header.parentSession === agent.id) ?? [];
            const lines = agents.length ? agents.map(item => `${item.id} | ${item.status}`).join('\n') : copy.noAgents;
            const runtime = services?.runtime?.status(agent.session) ?? '';
            return { kind: 'success', text: prefix + lines + '\n' + (runtime ? runtime + '\n' : '') + copy.agentsFootnote };
        }
        if (action.kind === 'reap-orphans') {
            return { kind: 'success', text: prefix + copy.reapOrphans };
        }
        if (services?.preferences?.globallyEnabled() === false && enablesPua(action)) {
            return { kind: 'error', text: copy.puaDisallowed };
        }
        if (action.kind === 'loop' && action.verify && (!subprocess || !agent.session.header.cwd)) {
            throw new Error(copy.loopRequiresSubprocess);
        }
        // 只读预检完成且未取消后才暂存开关；等待期间不让其他模型请求误用未完成配置。
        const evidence = action.kind === 'review' ? await collectGitEvidence(subprocess, agent.session.header.cwd, signal) : undefined;
        signal.throwIfAborted();
        if (action.kind === 'off' || action.kind === 'cancel-pua-loop' || action.kind === 'loop') {
            services?.runtime?.cancel(agent.session);
        }
        const stopped = action.kind === 'teardown-all' ? services?.runtime?.cancelAll() ?? 0 : 0;
        store.stage(agent.session, commandId, action);
        const state = store.read(agent.session);
        if (!state.enabled)
            services?.runtime?.cancel(agent.session);
        if (action.kind === 'configure') {
            return { kind: 'success', text: prefix + copy.configureSaved };
        }
        const task = actionPrompt(action, templates, services?.catalog ?? new SourceCatalog());
        if (task !== undefined) {
            signal.throwIfAborted();
            const message = createUserMessage({
                content: [{ type: 'text', text: `${action.kind === 'loop' ? LOOP_START + JSON.stringify({ ...action, id: commandId }) + '\n' : ''}这是通过 /pua 提交的用户请求。是否使用 PUA 及所选风味，以执行时的 DSH PUA 当前状态为准；如果用户已关闭模式，正常处理任务，不因这条历史请求重新启用。启用时执行完整原版核心、展示协议及当前角色，不能用摘要替代。遵循宿主权限与用户最新要求。\n\n${task}${evidence === undefined ? '' : '\n\n' + evidence}` }],
                source: pluginSource(COMMAND_PLUGIN),
            });
            // 明确的新任务排入后续轮次；对当前任务的纠偏在最近的步骤边界生效。
            if (action.kind === 'review' || action.kind === 'loop' || (action.kind === 'mode' && action.task) || (action.kind === 'activate' && action.task))
                agent.followup(message);
            else
                agent.steer(message);
            const kindName = copy.taskKinds[action.kind] ?? action.kind;
            const flavor = state.flavorLocked ? flavorLabel(state.flavor, lang) : copy.autoRouting;
            const loopInfo = action.kind === 'loop' ? (action.verify ? copy.loopOracleUser : copy.loopOracleHonor) : '';
            const evidenceInfo = evidence?.startsWith('未获取') ? copy.gitEvidenceMissing : '';
            return { kind: 'success', text: prefix + copy.taskSubmitted(kindName, flavor, loopInfo, evidenceInfo) };
        }
        if (action.kind === 'cancel-pua-loop') {
            return { kind: 'success', text: prefix + copy.loopCanceled };
        }
        if (action.kind === 'teardown-all') {
            return { kind: 'success', text: prefix + copy.stoppedLoops(stopped) };
        }
        if (action.kind === 'offline') {
            return { kind: 'success', text: prefix + copy.offline };
        }
        if (action.kind === 'off') {
            const scope = services?.preferences.description(lang) ?? (lang === 'zh' ? '当前会话' : 'Current session');
            return { kind: 'success', text: prefix + copy.off(scope) };
        }
        if (action.kind === 'flavor') {
            const scope = services?.preferences.description(lang) ?? (lang === 'zh' ? '当前会话' : 'Current session');
            const text = state.flavorLocked
                ? copy.flavorLocked(flavorLabel(state.flavor, lang), state.enabled, scope)
                : copy.flavorAuto(state.enabled, scope);
            return { kind: 'success', text: prefix + text };
        }
        return { kind: 'success', text: prefix + copy.taskModeEnabled(flavorLabel(state.flavor, lang)) };
    }
    catch (error) {
        store.rollback(agent.session, commandId);
        return {
            kind: 'error',
            text: signal.aborted
                ? (COMMAND_COPY[lang]?.commandCanceled ?? 'PUA 命令已取消。')
                : formatErrorMessage(error, lang),
        };
    }
}
//# sourceMappingURL=command.js.map