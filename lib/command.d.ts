import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands';
import { StateStore } from './state.js';
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { QualityCommand } from './content.js';
import type { Context } from '@deepseek-ai/cordis';
import { SourceCatalog } from './source.js';
import type { PreferencesBridge } from './settings.js';
import { type PuaRuntime } from './runtime.js';
interface Services {
    catalog: SourceCatalog;
    preferences: PreferencesBridge;
    runtime: PuaRuntime;
    ctx: Context;
}
export declare const HELP = "Usage:\n/pua [task description]: turn PUA on; without a description, continue the current task\n/pua review [scope]: read-only review, with this repository's Git index evidence attached when the host provides it\n/pua on / /pua off: change the current session only; does not change the global default and does not issue a model request\n/pua config {\"subagents\":true}: change current-session parameters\n/pua reset [parameter]: restore one parameter, or all of them, to following the global settings\n/pua flavor [name|auto]: list, lock, or restore automatic flavor routing; does not turn PUA on\n/pua p7|p9|p10|pro|yes|mama|shot|pua-en|pua-ja [task]: full original mode\n/pua ding [task]: Ding-inside/Ding-outside flavor\n/pua loop \"task\" --verify \"npm test\" --max-iterations 10: standalone verification loop; omitted parameters use the current session's effective defaults\n/pua cancel-loop or /pua-cancel-loop: cancel the current loop\n/pua kpi / /pua survey [quick]: original KPI and local survey\n/pua offline: stay in local mode, with no upload capability\n/pua team-status: status of the current session and its DSH subagents\n/pua reap-orphans / /pua teardown-all: reclaim this plugin's loops; does not delete worktrees managed by other tools\n/pua again: switch to a substantially different approach to the current goal\n/pua done-check: check the requirement, the delivered result, the acceptance evidence, and the gaps\n/pua evidence: review the evidence that exists and point out conclusions that are not yet proven\n/pua status: show the current configuration\n/pua -- task description: use when the task starts with a word that matches a control command\nOriginal colon commands map to DSH space subcommands, e.g. /pua:p9 \u2192 /pua p9.\nThe global switch is changed under Plugins by turning on \"Allow PUA\"; it only controls the command and chat entry points and never injects automatically. Settings namespace: phucnd0604-pua-en. With no settings it degrades to the current session and is off by default.";
/** Runs a native command; a failed delivery rolls back staged state, and the success state is restored from the host's command/done log. */
export declare function handleCommand(store: StateStore, invocation: CommandInvocation, templates: ReadonlyMap<QualityCommand, string>, subprocess?: Pick<SubprocessRuntime, 'spawn'>, services?: Services): Promise<CommandResult>;
export {};
