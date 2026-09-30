import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { parseArgs, type Action } from './args.js';
import { flavorLabel, listFlavors } from './i18n.js';
import { serverCopy, serverLang } from './server-copy.js';
import { StateStore, SESSION_RESULT_PREFIX as RESULT_PREFIX } from './state.js';
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { QualityCommand } from './content.js';
import { collectGitEvidence, reviewRules } from './review.js';
import type { Context } from '@deepseek-ai/cordis';
import { SourceCatalog } from './source.js';
import type { PreferencesBridge } from './settings.js';
import { LOOP_START, type PuaRuntime } from './runtime.js';
import { COMMAND_PLUGIN, pluginSource } from './message-source.js';

interface Services { catalog: SourceCatalog; preferences: PreferencesBridge; runtime: PuaRuntime; ctx: Context }


const ENABLING = new Set<Action['kind']>(['on', 'activate', 'review', 'mode', 'loop', 'again', 'done-check', 'evidence', 'kpi', 'survey']);
function enablesPua(action: Action): boolean {
  return ENABLING.has(action.kind) || (action.kind === 'configure' && action.patch.enabled === true);
}
function actionPrompt(action: Action, templates: ReadonlyMap<QualityCommand, string>, catalog: SourceCatalog): string | undefined {
  const copy = serverCopy().command;
  switch (action.kind) {
    case 'activate':
      return action.task ? copy.activateTask(action.task) : copy.activateContinue;
    case 'review':
      return `${reviewRules()}\n\n${copy.reviewScope(action.task)}`;
    case 'again': case 'done-check': case 'evidence':
      return templates.get(action.kind)! + (action.task ? copy.userAddition(action.task) : '');
    case 'mode':
      return copy.modePrompt(action.mode, action.task || copy.activateContinueShort);
    case 'loop':
      return copy.loopPrompt(action.task, action.maxIterations ? String(action.maxIterations) : copy.unlimited, action.verify ? copy.oracleByCommandLong : copy.oracleMissingLong);
    case 'kpi':
      return catalog.body('commands/kpi.md') + copy.kpiPrompt;
    case 'survey':
      return catalog.body('commands/survey.md') + copy.surveyPrompt(action.task ?? '', action.task === 'quick' ? '' : '\n\n' + catalog.body('skills/pua/references/survey.md'));
    default:
      return undefined;
  }
}

/** 执行原生命令；投递失败撤销临时状态，成功状态由宿主 command/done 日志恢复。 */
export async function handleCommand(store: StateStore, invocation: CommandInvocation, templates: ReadonlyMap<QualityCommand, string>, subprocess?: Pick<SubprocessRuntime, 'spawn'>, services?: Services): Promise<CommandResult> {
  const { agent, signal, commandId } = invocation;
  const copy = serverCopy().command;
  try {
    signal.throwIfAborted();
    const action = parseArgs(invocation.rawInput, store.configuration(agent.session));
    if (action.kind === 'help') return { kind: 'success', text: RESULT_PREFIX + copy.help };
    if (action.kind === 'flavors') return { kind: 'success', text: RESULT_PREFIX + listFlavors(serverLang()) + copy.flavorsExample };
    if (action.kind === 'status') {
      const state = store.read(agent.session);
      return { kind: 'success', text: RESULT_PREFIX + copy.status(state.enabled ? copy.enabled : copy.disabled, services?.runtime.effectiveMode(agent.session, state.mode) ?? state.mode, state.flavorLocked ? flavorLabel(state.flavor, serverLang()) + copy.locked : copy.autoRoute, services?.preferences.description() ?? copy.currentSession, services?.runtime.status(agent.session) ?? '') };
    }
    if (action.kind === 'team-status') {
      const agents = services?.ctx.get('agents')?.list().filter(item => item.id === agent.id || item.session.header.parentSession === agent.id) ?? [];
      return { kind: 'success', text: RESULT_PREFIX + (agents.length ? agents.map(item => `${item.id} | ${item.status}`).join('\n') : copy.teamStatusEmpty) + '\n' + (services?.runtime.status(agent.session) ?? '') + '\n' + copy.teamStatusFooter };
    }
    if (action.kind === 'reap-orphans') return { kind: 'success', text: RESULT_PREFIX + copy.reapOrphans };
    if (services?.preferences.globallyEnabled() === false && enablesPua(action)) {
      return { kind: 'error', text: copy.globallyOff };
    }
    if (action.kind === 'loop' && action.verify && (!subprocess || !agent.session.header.cwd)) throw new Error(copy.loopNeedsHost);
    // 只读预检完成且未取消后才暂存开关；等待期间不让其他模型请求误用未完成配置。
    const evidence = action.kind === 'review' ? await collectGitEvidence(subprocess, agent.session.header.cwd, signal) : undefined;
    signal.throwIfAborted();
    if (action.kind === 'off' || action.kind === 'cancel-pua-loop' || action.kind === 'loop') services?.runtime.cancel(agent.session);
    const stopped = action.kind === 'teardown-all' ? services?.runtime.cancelAll() ?? 0 : 0;
    store.stage(agent.session, commandId, action);
    const state = store.read(agent.session);
    if (!state.enabled) services?.runtime.cancel(agent.session);
    if (action.kind === 'configure') return { kind: 'success', text: RESULT_PREFIX + copy.configSaved };
    const task = actionPrompt(action, templates, services?.catalog ?? new SourceCatalog());
    if (task !== undefined) {
      signal.throwIfAborted();
      const message = createUserMessage({
        content: [{ type: 'text', text: `${action.kind === 'loop' ? LOOP_START + JSON.stringify({ ...action, id: commandId }) + '\n' : ''}${copy.modelRequestHeader}\n\n${task}${evidence === undefined ? '' : '\n\n' + evidence}` }],
        source: pluginSource(COMMAND_PLUGIN),
      });
      // 明确的新任务排入后续轮次；对当前任务的纠偏在最近的步骤边界生效。
      if (action.kind === 'review' || action.kind === 'loop' || (action.kind === 'mode' && action.task) || (action.kind === 'activate' && action.task)) agent.followup(message);
      else agent.steer(message);
      const kind = action.kind === 'mode' ? copy.modeKind(action.mode) : copy.kinds[action.kind] ?? action.kind;
      const oracle = action.kind === 'loop' ? '\n' + (action.verify ? copy.oracleByCommand : copy.oracleMissing) : '';
      const precheck = evidence?.startsWith(serverCopy().review.noEvidencePrefix) ? '\n' + copy.gitPrecheckMissing : '';
      return { kind: 'success', text: RESULT_PREFIX + copy.submitted(kind, state.flavorLocked ? flavorLabel(state.flavor, serverLang()) : copy.autoRoute, oracle + precheck) };
    }
    if (action.kind === 'cancel-pua-loop') return { kind: 'success', text: RESULT_PREFIX + copy.loopCancelled };
    if (action.kind === 'teardown-all') return { kind: 'success', text: RESULT_PREFIX + copy.teardown(stopped) };
    if (action.kind === 'offline') return { kind: 'success', text: RESULT_PREFIX + copy.offline };
    if (action.kind === 'off') return { kind: 'success', text: RESULT_PREFIX + copy.off(services?.preferences.description() ?? copy.currentSession) };
    if (action.kind === 'flavor') return { kind: 'success', text: RESULT_PREFIX + copy.flavorChanged(state.flavorLocked ? copy.flavorLocked(flavorLabel(state.flavor, serverLang())) : copy.flavorAuto, state.enabled ? copy.enabled : copy.disabled, services?.preferences.description() ?? copy.currentSession) };
    return { kind: 'success', text: RESULT_PREFIX + copy.activated(flavorLabel(state.flavor, serverLang())) };
  } catch (error) {
    store.rollback(agent.session, commandId);
    return { kind: 'error', text: signal.aborted ? copy.cancelled : error instanceof Error ? error.message : String(error) };
  }
}
