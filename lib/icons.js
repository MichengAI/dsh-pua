import { createElement as h } from 'react';
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives';
/** 0.1.7 exports the Regular name; 0.1.6 still uses the old names with a size suffix. When neither exists, render nothing. */
export function hostIcon(...names) {
    const bag = primitives;
    for (const name of names) {
        const icon = bag[name];
        if (typeof icon === 'function')
            return icon;
    }
    return () => null;
}
export const IconGauge = hostIcon('IconGaugeOutlineRegular', 'IconGaugeOutline16');
/** Uses the power symbol when off: it stays distinguishable from the gauge at 16px and does not strike through text. */
export function IconGaugeOff({ size = 16, className }) {
    return h('svg', { width: size, height: size, className, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }, h('path', { d: 'M8 1.6V6.6' }), h('path', { d: 'M5.15 3.85a4.7 4.7 0 1 0 5.7 0' }));
}
export const IconClose = hostIcon('IconCloseOutlineRegular', 'IconCloseOutline16');
export const IconChevronDown = hostIcon('IconChevronDownOutlineRegular', 'IconChevronDownOutline14');
export const IconChevronUp = hostIcon('IconChevronUpOutlineRegular', 'IconChevronUpOutline14');
//# sourceMappingURL=icons.js.map