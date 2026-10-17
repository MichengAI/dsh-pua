import { type ReactNode } from 'react';
type Icon = (props: {
    size?: number;
    className?: string;
}) => ReactNode;
/** 0.1.7 exports the Regular name; 0.1.6 still uses the old names with a size suffix. When neither exists, render nothing. */
export declare function hostIcon(...names: string[]): Icon;
export declare const IconGauge: Icon;
/** Uses the power symbol when off: it stays distinguishable from the gauge at 16px and does not strike through text. */
export declare function IconGaugeOff({ size, className }: {
    size?: number;
    className?: string;
}): ReactNode;
export declare const IconClose: Icon;
export declare const IconChevronDown: Icon;
export declare const IconChevronUp: Icon;
export {};
