/** 聊天入口独立读取全局可见性；新会话未就绪时快速重试，稳定后低频同步。 */
export function watchComposerConfiguration(remote, sessionId, onGlobal, onSession, onError = () => { }, errorText) {
    let active = true;
    let pending = false;
    let retryDelay = 250;
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
                onError('');
            }
        }).catch(() => { failed = true; if (active)
            onError(errorText); });
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
            const delay = failed ? retryDelay : 4000;
            retryDelay = failed ? Math.min(retryDelay * 2, 4000) : 250;
            timer = setTimeout(refresh, delay);
        });
    };
    refresh();
    return { refresh, dispose: () => { active = false; clearTimeout(timer); } };
}
/** 当前会话的短轮询；卸载后忽略在途结果，连接失败时不保留过期运行状态。 */
export function watchActivity(remote, sessionId, receive) {
    let active = true;
    let timer;
    async function refresh() {
        try {
            const result = await remote.getActivity(sessionId);
            if (active)
                receive(result.ok ? result.value : null);
        }
        catch {
            if (active)
                receive(null);
        }
        finally {
            if (active)
                timer = setTimeout(() => void refresh(), 750);
        }
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
}
//# sourceMappingURL=client-refresh.js.map