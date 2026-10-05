import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type ActivitySnapshot, type ConfigurationSnapshot } from './remote-contract.js';
import { type Configuration, type ConfigurationPatch } from './configuration.js';
/** 复用 DSH 已鉴权的 Typert Gateway；全局写入只由插件设置页调用。 */
export default class PuaRemote extends TypertRemoteService {
    static inject: string[];
    constructor(ctx: Context);
    private agent;
    getGlobal(): ConfigurationSnapshot;
    getActivity(id: string): ActivitySnapshot;
    setGlobal(input: Configuration, revision: number): Promise<ConfigurationSnapshot>;
    getSession(id: string): ConfigurationSnapshot;
    setSession(id: string, patch: ConfigurationPatch, revision: number): ConfigurationSnapshot;
    startLoop(id: string, task: string, input: Configuration): Promise<{
        text: string;
    }>;
    cancelLoop(id: string): Promise<{
        text: string;
    }>;
}
