import { createElement as h } from 'react';
import { IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconCloseOutlineRegular, IconGaugeOutlineRegular, } from '@deepseek-ai/dsh-client-ui-primitives';
/** Since 0.2.0 the host exports only the Regular / Medium names; the old size-suffixed aliases are gone. */
export const IconGauge = IconGaugeOutlineRegular;
/** Uses the power symbol when off: it stays distinguishable from the gauge at 16px and does not strike through text. */
export function IconGaugeOff({ size = 16, className }) {
    return h('svg', { width: size, height: size, className, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }, h('path', { d: 'M8 1.6V6.6' }), h('path', { d: 'M5.15 3.85a4.7 4.7 0 1 0 5.7 0' }));
}
export const IconClose = IconCloseOutlineRegular;
export const IconChevronDown = IconChevronDownOutlineRegular;
export const IconChevronUp = IconChevronUpOutlineRegular;
//# sourceMappingURL=icons.js.map