import React from 'react';
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import { type ConfigurationSnapshot, type PuaRemoteApi } from './remote-contract.js';
import type { SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client';
interface SlotRenderProps {
    sessionId?: string;
    /** 与宿主 conversation.input.dock 的 InputZone.session 同源，字段改动会在这里被类型检查拦住。 */
    session?: Pick<SessionSnapshot, 'sessionId' | 'running'>;
    view?: 'summary' | 'page';
}
/** 配置变更事件名：聊天入口与状态卡片据此在保存后立即刷新。 */
export declare const SETTINGS_UPDATED_EVENT = "pua:settings-updated";
export interface SettingsUpdatedDetail {
    global: boolean;
    sessionId?: string | undefined;
}
/** 向同页面广播配置已变更；保存成功后调用，供各入口按需重读。 */
export declare function notifySettingsUpdated(detail: SettingsUpdatedDetail): void;
/**
 * 入口按钮的禁用条件：只有「首次读取尚未返回」才禁用（避免打开空弹窗）。
 * 读取失败后必须保持可点击——读取失败时聊天入口是用户唯一可发现的重试入口。
 */
export declare function composerTriggerDisabled(snapshot: ConfigurationSnapshot | undefined, hasReadError: boolean): boolean;
interface ClientContext {
    slots: {
        inject(name: string, register: () => () => void): () => void;
        register(options: {
            name: string;
            id?: string;
            key?: string;
            order?: number;
            label?: string;
        }, render: (props: SlotRenderProps) => React.ReactNode): () => void;
    };
    remote: {
        $mount(contribution: TypertRemoteContribution): Promise<() => void>;
    };
    get(name: string): unknown;
    effect(callback: () => () => void): void;
    inject?(deps: string[], callback: (scope: {
        get?(name: string): unknown;
    }) => void | (() => void)): unknown;
}
export declare const inject: string[];
/** 两个入口共享字段与校验；会话入口永远不调用全局写入方法。 */
export declare function ConfigurationPanel({ remote, sessionId, hostLocale, onLoopStarted }: {
    remote: PuaRemoteApi;
    sessionId?: string | undefined;
    hostLocale?: string | undefined;
    onLoopStarted?: () => void;
}): React.ReactElement;
export declare function apply(ctx: ClientContext): Promise<() => void>;
export {};
