import React from 'react';
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import { type PuaRemoteApi } from './remote-contract.js';
interface SlotRenderProps {
    sessionId?: string;
    session?: {
        sessionId: string;
    };
    view?: 'summary' | 'page';
}
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
