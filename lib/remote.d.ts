import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type ActivitySnapshot, type ConfigurationSnapshot } from './remote-contract.js';
import { type Configuration, type ConfigurationPatch } from './configuration.js';
/** Reuses DSH's authenticated Typert Gateway; global writes are only issued by the plugin settings page. */
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
