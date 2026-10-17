import type { ActivitySnapshot, ConfigurationSnapshot, PuaRemoteApi } from './remote-contract.js';
/** The chat entry reads global visibility on its own; it retries quickly while a new session is not ready and syncs at low frequency once stable. */
export declare function watchComposerConfiguration(remote: Pick<PuaRemoteApi, 'getGlobal' | 'getSession'>, sessionId: string, onGlobal: (enabled: boolean) => void, onSession: (snapshot: ConfigurationSnapshot) => void, onError: ((message: string) => void) | undefined, errorText: string): {
    refresh: () => void;
    dispose: () => void;
};
/** Short polling for the current session; in-flight results are ignored after unmount and a failed connection never keeps stale running state. */
export declare function watchActivity(remote: Pick<PuaRemoteApi, 'getActivity'>, sessionId: string, receive: (value: ActivitySnapshot | null) => void): () => void;
