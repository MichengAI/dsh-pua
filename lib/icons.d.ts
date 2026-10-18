import { type ReactNode } from 'react';
/** Since 0.2.0 the host exports only the Regular / Medium names; the old size-suffixed aliases are gone. */
export declare const IconGauge: (props: import("@deepseek-ai/dsh-client-ui-primitives").IconProps) => import("react").JSX.Element;
/** Uses the power symbol when off: it stays distinguishable from the gauge at 16px and does not strike through text. */
export declare function IconGaugeOff({ size, className }: {
    size?: number;
    className?: string;
}): ReactNode;
export declare const IconClose: (props: import("@deepseek-ai/dsh-client-ui-primitives").IconProps) => import("react").JSX.Element;
export declare const IconChevronDown: (props: import("@deepseek-ai/dsh-client-ui-primitives").IconProps) => import("react").JSX.Element;
export declare const IconChevronUp: (props: import("@deepseek-ai/dsh-client-ui-primitives").IconProps) => import("react").JSX.Element;
