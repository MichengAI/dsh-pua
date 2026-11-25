/** 读取失败的快速退避：首轮覆盖宿主服务与会话就绪的常见耗时。 */
const RETRY_FAST = 250;
/** 快速退避的终点；到此为止视为宿主暂不可用。 */
const RETRY_FAST_CAP = 2000;
/**
 * 快速退避耗尽后的兜底间隔。不能用「停止重试」代替：读取失败会让聊天入口整块不渲染，
 * 用户没有可点击的恢复入口；而 30s 一次只在失败态发生，不构成闲置盲轮询。
 */
const RETRY_FLOOR = 30_000;
/** 聊天入口独立读取全局可见性；新会话未就绪时退避重试，就绪后按需刷新，避免盲轮询。 */
export function watchComposerConfiguration(remote, sessionId, onGlobal, onSession, onError = () => { }, errorText) {
    let active = true;
    let pending = false;
    let retryDelay = RETRY_FAST;
    let timer;
    const refresh = () => {
        if (!active || pending)
            return;
        clearTimeout(timer);
        pending = true;
        let failed = false;
        // 不用 Promise.all 将可见性绑在 Agent 的加载生命周期上。
        const global = Promise.resolve().then(() => remote.getGlobal()).then(result => {
            if (!result.ok)
                throw new Error(result.error.message);
            if (active) {
                onGlobal(result.value.values.enabled);
                onError(false);
            }
        }).catch(() => { failed = true; if (active)
            onError(errorText ?? true); });
        const session = Promise.resolve().then(() => remote.getSession(sessionId)).then(result => {
            if (!result.ok)
                throw new Error(result.error.message);
            if (active)
                onSession(result.value);
        }).catch(() => { failed = true; });
        void Promise.all([global, session]).then(() => {
            pending = false;
            if (!active)
                return;
            if (failed) {
                timer = setTimeout(refresh, retryDelay);
                retryDelay = retryDelay >= RETRY_FAST_CAP ? RETRY_FLOOR : retryDelay * 2;
            }
            else {
                retryDelay = RETRY_FAST;
            }
        });
    };
    refresh();
    return { refresh, dispose: () => { active = false; clearTimeout(timer); } };
}
/** 当前会话的任务状态观察；任务运行或验证期间按 750ms 轮询，闲置时自动休眠停机。 */
export function watchActivity(remote, sessionId, receive, options) {
    let active = true;
    let inFlight = false;
    let lastVisible = false;
    let timer;
    async function poll() {
        if (!active || inFlight)
            return;
        clearTimeout(timer);
        inFlight = true;
        try {
            const result = await remote.getActivity(sessionId);
            if (active) {
                lastVisible = result.ok ? Boolean(result.value?.visible) : false;
                receive(result.ok ? result.value : null);
            }
        }
        catch {
            if (active) {
                lastVisible = false;
                receive(null);
            }
        }
        finally {
            inFlight = false;
            if (active) {
                const isRunning = options?.isRunning ? options.isRunning() : true;
                // 未提供 isRunning 时保持连续轮询（向后兼容）；提供时由运行态或已可见状态决定是否继续。
                const shouldPoll = options?.isRunning ? (lastVisible || isRunning) : true;
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
//# sourceMappingURL=client-refresh.js.map