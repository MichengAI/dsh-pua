import { type ReactNode } from 'react';
/** 0.2.0 起宿主只导出 Regular / Medium，不再提供带尺寸后缀的旧名。 */
export declare const IconGauge: (props: import("@deepseek-ai/dsh-client-ui-primitives").IconProps) => import("react").JSX.Element;
/** 未开启时用电源符号，16 像素下和表盘分得开，也不划过文字。 */
export declare function IconGaugeOff({ size, className }: {
    size?: number;
    className?: string;
}): ReactNode;
export declare const IconClose: (props: import("@deepseek-ai/dsh-client-ui-primitives").IconProps) => import("react").JSX.Element;
export declare const IconChevronDown: (props: import("@deepseek-ai/dsh-client-ui-primitives").IconProps) => import("react").JSX.Element;
export declare const IconChevronUp: (props: import("@deepseek-ai/dsh-client-ui-primitives").IconProps) => import("react").JSX.Element;
