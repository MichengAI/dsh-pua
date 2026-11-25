import type { ActivitySnapshot, ConfigurationSnapshot, PuaRemoteApi } from './remote-contract.js';
/** 聊天入口独立读取全局可见性；新会话未就绪时退避重试，就绪后按需刷新，避免盲轮询。 */
export declare function watchComposerConfiguration(remote: Pick<PuaRemoteApi, 'getGlobal' | 'getSession'>, sessionId: string, onGlobal: (enabled: boolean) => void, onSession: (snapshot: ConfigurationSnapshot) => void, onError?: (message: string) => void, errorText?: string): {
    refresh: () => void;
    dispose: () => void;
};
export interface ActivityWatchOptions {
    /** 是否处于运行中；提供时支持闲置休眠，未提供时保持向后兼容的连续轮询。 */
    isRunning?: () => boolean;
}
export interface ActivityWatcher {
    (): void;
    refresh: () => void;
    dispose: () => void;
}
/** 当前会话的任务状态观察；任务运行或验证期间按 750ms 轮询，闲置时自动休眠停机。 */
export declare function watchActivity(remote: Pick<PuaRemoteApi, 'getActivity'>, sessionId: string, receive: (value: ActivitySnapshot | null) => void, options?: ActivityWatchOptions): ActivityWatcher;
