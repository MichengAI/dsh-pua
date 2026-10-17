import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { parseArgs } from './args.js';
import { flavorLabel, listFlavors } from './flavors.js';
import { StateStore, SESSION_RESULT_PREFIX as RESULT_PREFIX } from './state.js';
import { collectGitEvidence, REVIEW_RULES } from './review.js';
import { SourceCatalog } from './source.js';
import { LOOP_START } from './runtime.js';
import { COMMAND_PLUGIN, pluginSource } from './message-source.js';
export const HELP = `Usage:
/pua [task description]: turn PUA on; without a description, continue the current task
/pua review [scope]: read-only review, with this repository's Git index evidence attached when the host provides it
/pua on / /pua off: change the current session only; does not change the global default and does not issue a model request
/pua config {"subagents":true}: change current-session parameters
/pua reset [parameter]: restore one parameter, or all of them, to following the global settings
/pua flavor [name|auto]: list, lock, or restore automatic flavor routing; does not turn PUA on
/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [task]: full original mode
/pua ding [task]: Ding-inside/Ding-outside flavor
/pua loop "task" --verify "npm test" --max-iterations 10: standalone verification loop; omitted parameters use the current session's effective defaults
/pua cancel-loop or /pua-cancel-loop: cancel the current loop
/pua kpi / /pua survey [quick]: original KPI and local survey
/pua offline: stay in local mode, with no upload capability
/pua team-status: status of the current session and its DSH subagents
/pua reap-orphans / /pua teardown-all: reclaim this plugin's loops; does not delete worktrees managed by other tools
/pua again: switch to a substantially different approach to the current goal
/pua done-check: check the requirement, the delivered result, the acceptance evidence, and the gaps
/pua evidence: review the evidence that exists and point out conclusions that are not yet proven
/pua status: show the current configuration
/pua -- task description: use when the task starts with a word that matches a control command
Original colon commands map to DSH space subcommands, e.g. /pua:p9 → /pua p9.
The global switch is changed under Plugins by turning on "Allow PUA"; it only controls the command and chat entry points and never injects automatically. Settings namespace: phucnd0604-pua-en. With no settings it degrades to the current session and is off by default.`;
const ENABLING = new Set(['on', 'activate', 'review', 'mode', 'loop', 'again', 'done-check', 'evidence', 'kpi', 'survey']);
function enablesPua(action) {
    return ENABLING.has(action.kind) || (action.kind === 'configure' && action.patch.enabled === true);
}
function actionPrompt(action, templates, catalog) {
    switch (action.kind) {
        case 'activate':
            return action.task ? `Handle the task the user specifies below. Task body:\n\n${action.task}`
                : 'Continue the currently authorized task: first reconcile the goal and the existing evidence, diagnose, then finish the remaining work. If history holds no identifiable task, ask the user for the goal; do not invent one.';
        case 'review':
            return `${REVIEW_RULES}\n\nUser review scope: ${action.task}`;
        case 'again':
        case 'done-check':
        case 'evidence':
            return templates.get(action.kind) + (action.task ? `\n\nUser addition: ${action.task}` : '');
        case 'mode':
            return `Run the full original ${action.mode} mode.\n${action.task || 'Continue the currently authorized task; if history holds no task, ask the user for the goal.'}`;
        case 'loop':
            return `Run the task under the full PUA Loop protocol currently in effect: ${action.task}\nIteration cap for this run: ${action.maxIterations || 'unlimited'}; ${action.verify ? 'Oracle verifies independently with the command the user specifies.' : 'No Oracle configured, so the honor system applies; passing independent verification must not be claimed.'}Configuration is owned by DSH; do not run the setup shell scripts.`;
        case 'kpi':
            return catalog.body('commands/kpi.md') + '\n\nThe current pro original protocol is fully injected; build the report card from actual evidence only and do not invent history.';
        case 'survey':
            return catalog.body('commands/survey.md') + '\n\nArguments: ' + (action.task ?? '') + (action.task === 'quick' ? '' : '\n\n' + catalog.body('skills/pua/references/survey.md'));
        default:
            return undefined;
    }
}
/** Runs a native command; a failed delivery rolls back staged state, and the success state is restored from the host's command/done log. */
export async function handleCommand(store, invocation, templates, subprocess, services) {
    const { agent, signal, commandId } = invocation;
    try {
        signal.throwIfAborted();
        const action = parseArgs(invocation.rawInput, store.configuration(agent.session));
        if (action.kind === 'help')
            return { kind: 'success', text: RESULT_PREFIX + HELP };
        if (action.kind === 'flavors')
            return { kind: 'success', text: RESULT_PREFIX + listFlavors() + '\nFor example: /pua flavor huawei' };
        if (action.kind === 'status') {
            const state = store.read(agent.session);
            return { kind: 'success', text: `${RESULT_PREFIX}${state.enabled ? 'on' : 'off'}; mode: ${services?.runtime.effectiveMode(agent.session, state.mode) ?? state.mode}; flavor: ${state.flavorLocked ? flavorLabel(state.flavor) + ' (locked)' : 'automatic routing'}.\n${services?.preferences.description() ?? 'current session'}; full original 3.5.1 body.\n${services?.runtime.status(agent.session) ?? ''}` };
        }
        if (action.kind === 'team-status') {
            const agents = services?.ctx.get('agents')?.list().filter(item => item.id === agent.id || item.session.header.parentSession === agent.id) ?? [];
            return { kind: 'success', text: RESULT_PREFIX + (agents.length ? agents.map(item => `${item.id} | ${item.status}`).join('\n') : 'The host provides no subagent status.') + '\n' + (services?.runtime.status(agent.session) ?? '') + '\nDSH agents are managed by the host; there are no original PID/TTL files.' };
        }
        if (action.kind === 'reap-orphans')
            return { kind: 'success', text: RESULT_PREFIX + 'DSH already reclaims the loops of this plugin on cancel, abnormal exit, and uninstall; there are no standalone background processes or .claude orphan state to clean up. Subagents and worktrees owned by other tools are managed by their owner.' };
        if (services?.preferences.globallyEnabled() === false && enablesPua(action)) {
            return { kind: 'error', text: '"Allow PUA" is off, so the current session cannot turn it on. Open @phucnd0604/dsh-pua-en under Plugins, turn on "Allow PUA", and try again.' };
        }
        if (action.kind === 'loop' && action.verify && (!subprocess || !agent.session.header.cwd))
            throw new Error('Independent verification needs the host subprocess and a session working directory; the loop was not started.');
        // Stage the switch only after the read-only pre-check finished without cancellation; meanwhile no other model request may act on an incomplete configuration.
        const evidence = action.kind === 'review' ? await collectGitEvidence(subprocess, agent.session.header.cwd, signal) : undefined;
        signal.throwIfAborted();
        if (action.kind === 'off' || action.kind === 'cancel-pua-loop' || action.kind === 'loop')
            services?.runtime.cancel(agent.session);
        const stopped = action.kind === 'teardown-all' ? services?.runtime.cancelAll() ?? 0 : 0;
        store.stage(agent.session, commandId, action);
        const state = store.read(agent.session);
        if (!state.enabled)
            services?.runtime.cancel(agent.session);
        if (action.kind === 'configure')
            return { kind: 'success', text: RESULT_PREFIX + 'Session configuration saved; fields without an override keep following the global settings.' };
        const task = actionPrompt(action, templates, services?.catalog ?? new SourceCatalog());
        if (task !== undefined) {
            signal.throwIfAborted();
            const message = createUserMessage({
                content: [{ type: 'text', text: `${action.kind === 'loop' ? LOOP_START + JSON.stringify({ ...action, id: commandId }) + '\n' : ''}This is a user request submitted through /pua. Whether PUA is active and which flavor applies is decided by the current DSH PUA state at execution time; if the user has turned the mode off, handle the task normally and do not re-enable it because of this historical request. When active, run the full original core, the display protocol, and the current role; a summary is not an acceptable substitute. Follow host permissions and the user's latest requirements.\n\n${task}${evidence === undefined ? '' : '\n\n' + evidence}` }],
                source: pluginSource(COMMAND_PLUGIN),
            });
            // An explicit new task goes into a follow-up turn; a correction to the current task takes effect at the nearest step boundary.
            if (action.kind === 'review' || action.kind === 'loop' || (action.kind === 'mode' && action.task) || (action.kind === 'activate' && action.task))
                agent.followup(message);
            else
                agent.steer(message);
            return { kind: 'success', text: `${RESULT_PREFIX}Submitted ${action.kind === 'review' ? 'read-only review' : action.kind === 'mode' ? action.mode + ' mode' : action.kind === 'loop' ? 'Loop' : action.kind === 'done-check' ? 'done check' : action.kind === 'evidence' ? 'evidence check' : action.kind === 'again' ? 'alternative-approach request' : action.kind === 'activate' ? 'task request' : action.kind}, flavor: ${state.flavorLocked ? flavorLabel(state.flavor) : 'automatic routing'}. Check the follow-up results from the Agent.${action.kind === 'loop' ? '\n' + (action.verify ? 'Oracle: user-specified verification command.' : 'No Oracle configured; honor system only.') : ''}${evidence?.startsWith('No Git evidence') ? '\nThe Git pre-check produced no evidence; the Agent has been asked to add read-only verification.' : ''}` };
        }
        if (action.kind === 'cancel-pua-loop')
            return { kind: 'success', text: RESULT_PREFIX + 'The current Loop is cancelled; no further turns will be scheduled automatically.' };
        if (action.kind === 'teardown-all')
            return { kind: 'success', text: `${RESULT_PREFIX}Stopped ${stopped} loop(s) managed by this plugin; host subagents and worktrees owned by other tools were left untouched.` };
        if (action.kind === 'offline')
            return { kind: 'success', text: RESULT_PREFIX + 'Staying in local mode; no network refresh or reporting capability.' };
        if (action.kind === 'off')
            return { kind: 'success', text: RESULT_PREFIX + 'PUA is off and the Loop is cancelled. Scope: ' + (services?.preferences.description() ?? 'current session') + '.' };
        if (action.kind === 'flavor')
            return { kind: 'success', text: `${RESULT_PREFIX}${state.flavorLocked ? 'locked ' + flavorLabel(state.flavor) : 'automatic routing restored'}; the current mode is ${state.enabled ? 'on' : 'still off'}. Scope: ${services?.preferences.description() ?? 'current session'}.` };
        return { kind: 'success', text: `${RESULT_PREFIX}The current task mode is on, flavor: ${flavorLabel(state.flavor)}; it takes effect from the next model step.` };
    }
    catch (error) {
        store.rollback(agent.session, commandId);
        return { kind: 'error', text: signal.aborted ? 'PUA command cancelled.' : error instanceof Error ? error.message : String(error) };
    }
}
//# sourceMappingURL=command.js.map