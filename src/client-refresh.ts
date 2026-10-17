import type { ActivitySnapshot, ConfigurationSnapshot, PuaRemoteApi } from './remote-contract.js';

/** The chat entry reads global visibility on its own; it retries quickly while a new session is not ready and syncs at low frequency once stable. */
export function watchComposerConfiguration(
  remote: Pick<PuaRemoteApi, 'getGlobal' | 'getSession'>,
  sessionId: string,
  onGlobal: (enabled: boolean) => void,
  onSession: (snapshot: ConfigurationSnapshot) => void,
  onError: (message: string) => void = () => {},
  errorText: string,
): { refresh: () => void; dispose: () => void } {
  let active = true;
  let pending = false;
  let retryDelay = 250;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (!active || pending) return;
    clearTimeout(timer);
    pending = true;
    let failed = false;
    // Do not use Promise.all here: that would tie visibility to the agent load lifecycle.
    const global = Promise.resolve().then(() => remote.getGlobal()).then(result => {
      if (!result.ok) throw new Error(result.error.message);
      if (active) { onGlobal(result.value.values.enabled); onError(''); }
    }).catch(() => { failed = true; if (active) onError(errorText); });
    const session = Promise.resolve().then(() => remote.getSession(sessionId)).then(result => {
      if (!result.ok) throw new Error(result.error.message);
      if (active) onSession(result.value);
    }).catch(() => { failed = true; });
    void Promise.all([global, session]).then(() => {
      pending = false;
      if (!active) return;
      const delay = failed ? retryDelay : 4000;
      retryDelay = failed ? Math.min(retryDelay * 2, 4000) : 250;
      timer = setTimeout(refresh, delay);
    });
  };
  refresh();
  return { refresh, dispose: () => { active = false; clearTimeout(timer); } };
}

/** Short polling for the current session; in-flight results are ignored after unmount and a failed connection never keeps stale running state. */
export function watchActivity(remote: Pick<PuaRemoteApi, 'getActivity'>, sessionId: string,
  receive: (value: ActivitySnapshot | null) => void): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function refresh() {
    try {
      const result = await remote.getActivity(sessionId);
      if (active) receive(result.ok ? result.value : null);
    } catch { if (active) receive(null); }
    finally { if (active) timer = setTimeout(() => void refresh(), 750); }
  }
  void refresh();
  return () => { active = false; clearTimeout(timer); };
}
