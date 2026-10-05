import type { ActivitySnapshot, ConfigurationSnapshot, PuaRemoteApi } from './remote-contract.js';
/** 聊天入口独立读取全局可见性；新会话未就绪时快速重试，稳定后低频同步。 */
export declare function watchComposerConfiguration(remote: Pick<PuaRemoteApi, 'getGlobal' | 'getSession'>, sessionId: string, onGlobal: (enabled: boolean) => void, onSession: (snapshot: ConfigurationSnapshot) => void, onError: ((message: string) => void) | undefined, errorText: string): {
    refresh: () => void;
    dispose: () => void;
};
/** 当前会话的短轮询；卸载后忽略在途结果，连接失败时不保留过期运行状态。 */
export declare function watchActivity(remote: Pick<PuaRemoteApi, 'getActivity'>, sessionId: string, receive: (value: ActivitySnapshot | null) => void): () => void;
