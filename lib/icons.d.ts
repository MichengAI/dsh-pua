import type { ReactNode } from 'react';
type Icon = (props: {
    size?: number;
    className?: string;
}) => ReactNode;
/** 0.1.7 导出 Regular；0.1.6 仍用带尺寸后缀的旧名。都没有时渲染为空。 */
export declare function hostIcon(...names: string[]): Icon;
export declare const IconGauge: Icon;
export declare const IconClose: Icon;
export declare const IconChevronDown: Icon;
export declare const IconChevronUp: Icon;
export {};
