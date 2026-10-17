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
/** Both entries share fields and validation; the session entry never calls the global write methods. */
export declare function ConfigurationPanel({ remote, sessionId, hostLocale, onLoopStarted }: {
    remote: PuaRemoteApi;
    sessionId?: string | undefined;
    hostLocale?: string | undefined;
    onLoopStarted?: () => void;
}): React.ReactElement;
export declare function apply(ctx: ClientContext): Promise<() => void>;
export {};
