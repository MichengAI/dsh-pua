import type { ActivitySnapshot, ConfigurationSnapshot, PuaRemoteApi } from './remote-contract.js';

/** 聊天入口独立读取全局可见性；新会话未就绪时退避重试，就绪后按需刷新，避免盲轮询。 */
export function watchComposerConfiguration(
  remote: Pick<PuaRemoteApi, 'getGlobal' | 'getSession'>,
  sessionId: string,
  onGlobal: (enabled: boolean) => void,
  onSession: (snapshot: ConfigurationSnapshot) => void,
  onError: (error: boolean | string) => void = () => {},
  errorText?: string,
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
    // 不用 Promise.all 将可见性绑在 Agent 的加载生命周期上。
    const global = Promise.resolve().then(() => remote.getGlobal()).then(result => {
      if (!result.ok) throw new Error(result.error.message);
      if (active) { onGlobal(result.value.values.enabled); onError(false); }
    }).catch(() => { failed = true; if (active) onError(errorText ?? true); });
    const session = Promise.resolve().then(() => remote.getSession(sessionId)).then(result => {
      if (!result.ok) throw new Error(result.error.message);
      if (active) onSession(result.value);
    }).catch(() => { failed = true; });
    void Promise.all([global, session]).then(() => {
      pending = false;
      if (!active) return;
      if (failed) {
        timer = setTimeout(refresh, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 4000);
      } else {
        retryDelay = 250;
      }
    });
  };
  refresh();
  return { refresh, dispose: () => { active = false; clearTimeout(timer); } };
}

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
export function watchActivity(
  remote: Pick<PuaRemoteApi, 'getActivity'>,
  sessionId: string,
  receive: (value: ActivitySnapshot | null) => void,
  options?: ActivityWatchOptions,
): ActivityWatcher {
  let active = true;
  let inFlight = false;
  let lastVisible = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function poll() {
    if (!active || inFlight) return;
    clearTimeout(timer);
    inFlight = true;
    try {
      const result = await remote.getActivity(sessionId);
      if (active) {
        lastVisible = result.ok ? Boolean(result.value?.visible) : false;
        receive(result.ok ? result.value : null);
      }
    } catch {
      if (active) {
        lastVisible = false;
        receive(null);
      }
    } finally {
      inFlight = false;
      if (active) {
        const isRunning = options?.isRunning ? options.isRunning() : true;
        const shouldPoll = lastVisible || isRunning;
        if (shouldPoll) {
          timer = setTimeout(() => void poll(), 750);
        }
      }
    }
  }

  void poll();

  const dispose = () => {
    active = false;
    clearTimeout(timer);
  };
  const handle = Object.assign(dispose, {
    refresh: () => void poll(),
    dispose,
  });
  return handle;
}
