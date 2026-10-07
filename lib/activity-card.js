import React, { useEffect, useState } from 'react';
import { IconChevronDown, IconChevronUp, IconClose, IconGauge } from './icons.js';
import { watchActivity } from './client-refresh.js';
import { modeName } from './display.js';
import { ACTIVITY, flavorLabel, resolveUiLang } from './i18n.js';
const h = React.createElement;
function iconButton(label, onClick, icon, extra = {}) {
    return h('button', { type: 'button', title: label, 'aria-label': label, onClick, ...extra }, icon);
}
/** 沿用官方输入区 dock；任务结束后卸下卡片，折叠只影响显示。操作按钮跟 BTW 气泡同一套圆形图标。 */
export function ActivityCard({ remote, sessionId, hostLocale }) {
    const [snapshot, setSnapshot] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => watchActivity(remote, sessionId, value => {
        setSnapshot(value);
        if (!value?.visible) {
            setExpanded(false);
            setError('');
        }
    }), [remote, sessionId]);
    if (!snapshot?.visible)
        return null;
    const loop = snapshot.loop;
    const config = snapshot.configuration;
    const lang = resolveUiLang(config.language, hostLocale);
    const copy = ACTIVITY[lang];
    const label = snapshot.verifying ? copy.statusVerifying : loop ? copy.statusLoop : copy.statusTask;
    const iteration = loop ? copy.iteration(loop.iteration, loop.maxIterations) : '';
    const title = ['PUA', label, iteration].filter(Boolean).join(' · ');
    const fields = [
        [copy.fields.mode, modeName(config.mode, lang)],
        [copy.fields.flavor, config.flavor === 'auto' ? copy.auto : flavorLabel(config.flavor, lang)],
        [copy.fields.subagents, config.subagents ? copy.on : copy.off],
        ...(loop ? [
            [copy.fields.loopIterations, `${loop.iteration} / ${loop.maxIterations > 0 ? loop.maxIterations : copy.unlimited}`],
            [copy.fields.verification, loop.verification === 'command' ? copy.byCommand : copy.byModel],
            [copy.fields.timeout, loop.verification === 'command' ? copy.seconds(loop.verificationTimeout) : copy.timeoutNA],
        ] : []),
        [copy.fields.failures, String(snapshot.failureCount)],
        ...(loop ? [[copy.fields.rejections, copy.times(loop.rejections)]] : []),
    ];
    async function cancel() {
        setBusy(true);
        setError('');
        try {
            const result = await remote.cancelLoop(sessionId);
            if (!result.ok)
                throw new Error(result.error.message);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : copy.cancelFailed);
        }
        finally {
            setBusy(false);
        }
    }
    return h('div', { className: 'pua-activity-dock' }, h('section', { className: 'pua-activity', 'aria-label': copy.ariaLabel }, h('div', { className: 'pua-activity-header' }, h('span', { className: 'pua-activity-symbol', 'aria-hidden': true }, h(IconGauge)), h('span', { className: 'pua-activity-summary', role: 'status' }, title), h('div', { className: 'pua-activity-actions' }, iconButton(copy.toggle(expanded), () => setExpanded(value => !value), h(expanded ? IconChevronDown : IconChevronUp), { 'aria-expanded': expanded }), loop && iconButton(busy ? copy.cancelBusy : copy.cancel, () => void cancel(), h(IconClose), { disabled: busy }))), expanded && h('dl', { className: 'pua-activity-body pua-activity-fields' }, fields.map(([name, value]) => h('div', { key: name }, h('dt', null, name), h('dd', null, value)))), error && h('p', { className: 'pua-error', role: 'alert' }, error)));
}
// 与 BTW 使用同一组宿主输入框尺寸变量和圆形图标按钮。
export const ACTIVITY_CSS = `.pua-entry-icon{display:inline-flex;align-items:center;flex:none;width:16px;height:16px}.pua-trigger{display:inline-flex;align-items:center;gap:4px}.pua-activity-dock{display:flex;flex:none;flex-direction:column;gap:8px;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px));max-width:var(--dsh-composer-card-max-width,100%);margin:0 auto;max-height:440px;overflow:auto;padding:4px 0 10px;box-sizing:border-box;letter-spacing:0}.pua-activity{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;min-width:0;flex-shrink:0;font-size:13px;line-height:1.6;font-family:var(--dsw-font-family,inherit);letter-spacing:0}.pua-activity-header{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;min-width:0;min-height:44px;box-sizing:border-box}.pua-activity-symbol{display:flex;align-items:center;color:var(--dsw-alias-label-secondary);height:28px;flex-shrink:0}.pua-activity-summary{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:500;line-height:22px;max-height:66px;overflow:auto}.pua-activity-actions{display:flex;gap:4px;flex-shrink:0}.pua-activity-actions button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;transition:background-color 120ms ease}.pua-activity-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.pua-activity-actions button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-alias-label-primary));outline-offset:-2px}.pua-activity-actions button:disabled{cursor:wait;opacity:.5}.pua-activity-body{padding:0 14px 14px;color:var(--dsw-alias-label-secondary)}.pua-activity-fields{margin:0}.pua-activity-fields>div{display:grid;grid-template-columns:144px minmax(0,1fr);align-items:baseline;gap:16px;min-width:0;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l2)}.pua-activity-fields dt{font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.pua-activity-fields dd{margin:0;min-width:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}@media(max-width:480px){.pua-activity-fields>div{grid-template-columns:120px minmax(0,1fr);gap:12px}}.pua-activity .pua-error{margin:0;padding:0 14px 12px}@media(max-width:480px){.pua-activity-dock{max-height:330px}.pua-activity-header{padding:6px 8px 6px 12px;gap:6px}.pua-activity-actions{gap:0}.pua-activity-actions button{width:36px;height:36px}.pua-activity-body{padding:0 12px 12px}}@media(prefers-reduced-motion:reduce){.pua-activity-actions button{transition:none}}`;
//# sourceMappingURL=activity-card.js.map