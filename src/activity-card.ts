import React, { useEffect, useState } from 'react';
import { IconChevronDownOutline14, IconChevronUpOutline14, IconCloseOutline16, IconGaugeOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ActivitySnapshot, PuaRemoteApi } from './remote-contract.js';

import { watchActivity } from './client-refresh.js';

import { modeNames } from './display.js';
import { FLAVORS } from './flavors.js';

const h = React.createElement;

function iconButton(label: string, onClick: () => void, icon: React.ReactElement, extra: Record<string, unknown> = {}) {
  return h('button', { type: 'button', title: label, 'aria-label': label, onClick, ...extra }, icon);
}

/** 沿用官方输入区 dock；任务结束后卸下卡片，折叠只影响显示。操作按钮跟 BTW 气泡同一套圆形图标。 */
export function ActivityCard({ remote, sessionId }: { remote: PuaRemoteApi; sessionId: string }): React.ReactElement | null {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => watchActivity(remote, sessionId, value => {
    setSnapshot(value);
    if (!value?.visible) { setExpanded(false); setError(''); }
  }), [remote, sessionId]);
  if (!snapshot?.visible) return null;
  const loop = snapshot.loop;
  const label = snapshot.verifying ? '正在验收' : loop ? 'Loop 运行中' : '任务执行中';
  const iteration = loop ? `第 ${loop.iteration} 轮${loop.maxIterations > 0 ? ` / ${loop.maxIterations} 轮` : ''}` : '';
  const title = ['PUA', label, iteration].filter(Boolean).join(' · ');
  const config = snapshot.configuration;
  const fields: [string, string][] = [
    ['角色模式', modeNames[config.mode] ?? config.mode],
    ['风味', config.flavor === 'auto' ? '自动' : FLAVORS.find(item => item.id === config.flavor)?.label ?? config.flavor],
    ['对子代理启用', config.subagents ? '开启' : '关闭'],
    ...(loop ? [
      ['Loop 轮次', `${loop.iteration} / ${loop.maxIterations > 0 ? loop.maxIterations : '不限'}`],
      ['验收方式', loop.verification === 'command' ? '独立验收命令' : '模型报告'],
      ['验收超时', loop.verification === 'command' ? `${loop.verificationTimeout} 秒` : '不适用'],
    ] as [string, string][] : []),
    ['连续终端失败观察', String(snapshot.failureCount)],
    ...(loop ? [['验收未通过', `${loop.rejections} 次`]] as [string, string][] : []),
  ];
  async function cancel() {
    setBusy(true); setError('');
    try {
      const result = await remote.cancelLoop(sessionId);
      if (!result.ok) throw new Error(result.error.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '取消失败，请重试。'); }
    finally { setBusy(false); }
  }
  return h('div', { className: 'pua-activity-dock' }, h('section', { className: 'pua-activity', 'aria-label': 'PUA 运行状态' },
    h('div', { className: 'pua-activity-header' },
      h('span', { className: 'pua-activity-symbol', 'aria-hidden': true }, h(IconGaugeOutline16)),
      h('span', { className: 'pua-activity-summary', role: 'status' }, title),
      h('div', { className: 'pua-activity-actions' },
        iconButton(expanded ? '收起' : '展开', () => setExpanded(value => !value),
          expanded ? h(IconChevronDownOutline14) : h(IconChevronUpOutline14), { 'aria-expanded': expanded }),
        loop && iconButton(busy ? '正在取消…' : '取消 Loop', () => void cancel(), h(IconCloseOutline16), { disabled: busy }))),
    expanded && h('dl', { className: 'pua-activity-body pua-activity-fields' }, fields.map(([name, value]) =>
      h('div', { key: name }, h('dt', null, name), h('dd', null, value)))),
    error && h('p', { className: 'pua-error', role: 'alert' }, error)));
}

// 与 BTW 使用同一组宿主输入框尺寸变量和圆形图标按钮。
export const ACTIVITY_CSS = `.pua-entry-icon{display:inline-flex;align-items:center;flex:none;width:16px;height:16px}.pua-trigger{display:inline-flex;align-items:center;gap:4px}.pua-trigger[data-disabled=true] .pua-entry-icon{opacity:.5}.pua-activity-dock{display:flex;flex:none;flex-direction:column;gap:8px;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px));max-width:var(--dsh-composer-card-max-width,100%);margin:0 auto;max-height:440px;overflow:auto;padding:4px 0 10px;box-sizing:border-box;letter-spacing:0}.pua-activity{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;min-width:0;flex-shrink:0;font-size:13px;line-height:1.6;font-family:var(--dsw-font-family,inherit);letter-spacing:0}.pua-activity-header{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;min-width:0;min-height:44px;box-sizing:border-box}.pua-activity-symbol{display:flex;align-items:center;color:var(--dsw-alias-label-secondary);height:28px;flex-shrink:0}.pua-activity-summary{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:500;line-height:22px;max-height:66px;overflow:auto}.pua-activity-actions{display:flex;gap:4px;flex-shrink:0}.pua-activity-actions button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;transition:background-color 120ms ease}.pua-activity-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.pua-activity-actions button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-alias-label-primary));outline-offset:-2px}.pua-activity-actions button:disabled{cursor:wait;opacity:.5}.pua-activity-body{padding:0 14px 14px;color:var(--dsw-alias-label-secondary)}.pua-activity-fields{margin:0}.pua-activity-fields>div{display:grid;grid-template-columns:144px minmax(0,1fr);align-items:baseline;gap:16px;min-width:0;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l2)}.pua-activity-fields dt{font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.pua-activity-fields dd{margin:0;min-width:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}@media(max-width:480px){.pua-activity-fields>div{grid-template-columns:120px minmax(0,1fr);gap:12px}}.pua-activity .pua-error{margin:0;padding:0 14px 12px}@media(max-width:480px){.pua-activity-dock{max-height:330px}.pua-activity-header{padding:6px 8px 6px 12px;gap:6px}.pua-activity-actions{gap:0}.pua-activity-actions button{width:36px;height:36px}.pua-activity-body{padding:0 12px 12px}}@media(prefers-reduced-motion:reduce){.pua-activity-actions button{transition:none}}`;
