import React, { useEffect, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ActivitySnapshot, PuaRemoteApi } from './remote-contract.js';

import { watchActivity } from './client-refresh.js';

import { modeNames } from './display.js';
import { FLAVORS } from './flavors.js';

const h = React.createElement;

/** 沿用官方输入区 dock；任务结束后卸下卡片，折叠只影响显示。 */
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
      h('strong', null, 'PUA'),
      h('span', { className: 'pua-activity-summary', role: 'status' }, [label, iteration].filter(Boolean).join(' · ')),
      h('div', { className: 'pua-activity-actions' }, h(Button, { variant: 'toolbar', 'aria-expanded': expanded, onClick: () => setExpanded(value => !value) }, expanded ? '收起' : '详情'),
      loop && h(Button, { variant: 'toolbar', disabled: busy, onClick: () => void cancel() }, busy ? '正在取消…' : '取消 Loop'))),
    expanded && h('dl', { className: 'pua-activity-body pua-activity-fields' }, fields.map(([label, value]) =>
      h('div', { key: label }, h('dt', null, label), h('dd', null, value)))),
    error && h('p', { className: 'pua-error', role: 'alert' }, error)));
}

// 与 BTW 使用同一组宿主输入框尺寸变量；dock 本身可能横跨整个窗口。
export const ACTIVITY_CSS = `.pua-activity-dock{display:flex;flex:none;flex-direction:column;gap:8px;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px));max-width:var(--dsh-composer-card-max-width,100%);margin:0 auto;max-height:440px;overflow:auto;padding:4px 0 10px;box-sizing:border-box;letter-spacing:0}.pua-activity{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;min-width:0;flex-shrink:0;font-size:13px;line-height:1.6;font-family:var(--dsw-font-family,inherit);letter-spacing:0}.pua-activity-header{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;min-width:0;min-height:44px;box-sizing:border-box}.pua-activity-summary{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:500;line-height:22px;color:var(--dsw-alias-label-secondary)}.pua-activity-actions{display:flex;gap:4px;flex-shrink:0}.pua-activity-actions button{background:transparent;min-height:28px;padding:0 8px}.pua-activity-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.pua-activity-body{padding:0 14px 14px;color:var(--dsw-alias-label-secondary)}.pua-activity-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px;margin:0}.pua-activity-fields>div{min-width:0}.pua-activity-fields dt{font-size:12px;color:var(--dsw-alias-label-secondary)}.pua-activity-fields dd{margin:2px 0 0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}@media(max-width:480px){.pua-activity-fields{grid-template-columns:minmax(0,1fr);gap:8px}}.pua-activity .pua-error{margin:0 14px 14px}@media(max-width:480px){.pua-activity-dock{max-height:330px}.pua-activity-header{padding:6px 8px 6px 12px;gap:6px}.pua-activity-actions button{min-height:36px;padding:0 6px}.pua-activity-body{padding:0 12px 12px}}`;
