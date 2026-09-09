import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { parseArgs, type Action } from './args.js';
import { flavorLabel, listFlavors } from './flavors.js';
import { StateStore, RESULT_PREFIX } from './state.js';
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { QualityCommand } from './content.js';
import { collectGitEvidence, REVIEW_RULES } from './review.js';
import type { Context } from '@deepseek-ai/cordis';
import { SourceCatalog } from './source.js';
import type { PreferencesBridge } from './settings.js';
import { LOOP_START, type PuaRuntime } from './runtime.js';

interface Services { catalog: SourceCatalog; preferences: PreferencesBridge; runtime: PuaRuntime; ctx: Context }

export const HELP = `用法：
/pua [任务描述]：开启 PUA；无描述时继续当前任务
/pua review [范围]：只读审查，附带当前仓库 Git 索引证据（宿主可用时）
/pua on / /pua off：开启或关闭；有 settings 时同步 profile 默认，不发起模型请求
/pua flavor [名称|auto]：列出、锁定或恢复自动选味，不自动开启
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [任务]：完整原版模式
/pua ding [任务]：钉内/钉外味
/pua loop "任务" --verify "npm test" --max-iterations 10：独立验收循环；省略上限为无限，省略 verify 为 honor system
/pua cancel-pua-loop 或 /cancel-pua-loop：取消当前循环
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
设置页命名空间：michengai-pua。无 settings 时降级为当前会话，默认关闭。`;

function actionPrompt(action: Action, templates: ReadonlyMap<QualityCommand, string>, catalog: SourceCatalog): string | undefined {
  switch (action.kind) {
    case 'activate':
      return action.task ? `请处理下面用户指定的任务。任务正文：\n\n${action.task}`
        : '继续当前已授权任务：先核对目标和现有证据，诊断后完成剩余工作。若历史没有可识别任务，请用户提供目标，不自行编造任务。';
    case 'review':
      return `${REVIEW_RULES}\n\n用户审查范围：${action.task}`;
    case 'again': case 'done-check': case 'evidence':
      return templates.get(action.kind)! + (action.task ? `\n\n用户补充：${action.task}` : '');
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
export async function handleCommand(store: StateStore, invocation: CommandInvocation, templates: ReadonlyMap<QualityCommand, string>, subprocess?: Pick<SubprocessRuntime, 'spawn'>, services?: Services): Promise<CommandResult> {
  const { agent, signal, commandId } = invocation;
  try {
    signal.throwIfAborted();
    const action = parseArgs(invocation.rawInput);
    if (action.kind === 'help') return { kind: 'success', text: RESULT_PREFIX + HELP };
    if (action.kind === 'flavors') return { kind: 'success', text: RESULT_PREFIX + listFlavors() + '\n例如：/pua flavor huawei' };
    if (action.kind === 'status') {
      const state = store.read(agent.session);
      return { kind: 'success', text: `${RESULT_PREFIX}${state.enabled ? '已开启' : '已关闭'}；模式：${services?.runtime.effectiveMode(agent.session, state.mode) ?? state.mode}；风味：${state.flavorLocked ? flavorLabel(state.flavor) + '（锁定）' : '自动路由'}。\n${services?.preferences.description() ?? '当前会话'}；原版 3.5.1 完整正文。\n${services?.runtime.status(agent.session) ?? ''}` };
    }
    if (action.kind === 'team-status') {
      const agents = services?.ctx.get('agents')?.list().filter(item => item.id === agent.id || item.session.header.parentSession === agent.id) ?? [];
      return { kind: 'success', text: RESULT_PREFIX + (agents.length ? agents.map(item => `${item.id} | ${item.status}`).join('\n') : '宿主未提供子代理状态。') + '\n' + (services?.runtime.status(agent.session) ?? '') + '\nDSH Agent 由宿主管理，无原版 PID/TTL 文件。' };
    }
    if (action.kind === 'reap-orphans') return { kind: 'success', text: RESULT_PREFIX + 'DSH 已在取消、异常结束和卸载时回收本插件循环；没有独立后台进程或 .claude 孤儿状态可清理。其他工具的子代理/worktree 由所属工具管理。' };
    if (action.kind === 'loop' && action.verify && (!subprocess || !agent.session.header.cwd)) throw new Error('独立验收需要宿主 subprocess 和会话工作目录；未启动循环。');
    // 只读预检完成且未取消后才暂存开关；等待期间不让其他模型请求误用未完成配置。
    const evidence = action.kind === 'review' ? await collectGitEvidence(subprocess, agent.session.header.cwd, signal) : undefined;
    signal.throwIfAborted();
    await services?.preferences.update(action);
    if (action.kind === 'off' || action.kind === 'cancel-pua-loop' || action.kind === 'loop') services?.runtime.cancel(agent.session);
    const stopped = action.kind === 'teardown-all' ? services?.runtime.cancelAll() ?? 0 : 0;
    store.stage(agent.session, commandId, action);
    const state = store.read(agent.session);
    const task = actionPrompt(action, templates, services?.catalog ?? new SourceCatalog());
    if (task !== undefined) {
      signal.throwIfAborted();
      const message = createUserMessage({
        content: [{ type: 'text', text: `${action.kind === 'loop' ? LOOP_START + JSON.stringify({ ...action, id: commandId }) + '\n' : ''}这是通过 /pua 提交的用户请求。是否使用 PUA 及所选风味，以执行时的 DSH PUA 当前状态为准；如果用户已关闭模式，正常处理任务，不因这条历史请求重新启用。启用时执行完整原版核心、展示协议及当前角色，不能用摘要替代。遵循宿主权限与用户最新要求。\n\n${task}${evidence === undefined ? '' : '\n\n' + evidence}` }],
        source: { kind: 'plugin', plugin: '@michengai/dsh-pua' },
      });
      // 明确的新任务排入后续轮次；对当前任务的纠偏在最近的步骤边界生效。
      if (action.kind === 'review' || action.kind === 'loop' || (action.kind === 'mode' && action.task) || (action.kind === 'activate' && action.task)) agent.followup(message);
      else agent.steer(message);
      return { kind: 'success', text: `${RESULT_PREFIX}已提交${action.kind === 'review' ? '只读审查' : action.kind === 'mode' ? action.mode + ' 模式' : action.kind === 'loop' ? 'Loop' : action.kind === 'done-check' ? '完成检查' : action.kind === 'evidence' ? '证据检查' : action.kind === 'again' ? '换方法请求' : action.kind === 'activate' ? '任务请求' : action.kind}，风味：${state.flavorLocked ? flavorLabel(state.flavor) : '自动路由'}。请查看 Agent 后续结果。${action.kind === 'loop' ? '\n' + (action.verify ? 'Oracle：用户指定验证命令。' : '未配置 Oracle，仅 honor system。') : ''}${evidence?.startsWith('未获取') ? '\nGit 预检未取得证据，已要求 Agent 补充只读验证。' : ''}` };
    }
    if (action.kind === 'cancel-pua-loop') return { kind: 'success', text: RESULT_PREFIX + '当前 Loop 已取消，不再自动续轮。' };
    if (action.kind === 'teardown-all') return { kind: 'success', text: `${RESULT_PREFIX}已停止本插件管理的 ${stopped} 个循环；未删除宿主子代理或其他工具的 worktree。` };
    if (action.kind === 'offline') return { kind: 'success', text: RESULT_PREFIX + '保持本地模式，无联网刷新或上报能力。' };
    if (action.kind === 'off') return { kind: 'success', text: RESULT_PREFIX + 'PUA 已关闭，Loop 已取消。范围：' + (services?.preferences.description() ?? '当前会话') + '。' };
    if (action.kind === 'flavor') return { kind: 'success', text: `${RESULT_PREFIX}${state.flavorLocked ? '已锁定' + flavorLabel(state.flavor) : '已恢复自动路由'}；当前模式${state.enabled ? '已开启' : '仍关闭'}。范围：${services?.preferences.description() ?? '当前会话'}。` };
    return { kind: 'success', text: `${RESULT_PREFIX}当前任务模式已开启，风味：${flavorLabel(state.flavor)}，从下次模型步骤生效。` };
  } catch (error) {
    store.rollback(agent.session, commandId);
    return { kind: 'error', text: signal.aborted ? 'PUA 命令已取消。' : error instanceof Error ? error.message : String(error) };
  }
}
