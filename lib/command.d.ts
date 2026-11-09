import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands';
import { StateStore } from './state.js';
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { QualityCommand } from './content.js';
import type { Context } from '@deepseek-ai/cordis';
import { SourceCatalog } from './source.js';
import type { PreferencesBridge } from './settings.js';
import { type PuaRuntime } from './runtime.js';
import { type UiLang } from './i18n.js';
interface Services {
    catalog: SourceCatalog;
    preferences: PreferencesBridge;
    runtime: PuaRuntime;
    ctx: Context;
}
export declare const HELP_TEXTS: Record<UiLang, string>;
export declare const HELP: string;
/** 执行原生命令；投递失败撤销临时状态，成功状态由宿主 command/done 日志恢复。 */
export declare function handleCommand(store: StateStore, invocation: CommandInvocation, templates: ReadonlyMap<QualityCommand, string>, subprocess?: Pick<SubprocessRuntime, 'spawn'>, services?: Services): Promise<CommandResult>;
export {};
