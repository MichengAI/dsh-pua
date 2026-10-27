import { createElement as h } from 'react';
import { IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconCloseOutlineRegular, IconGaugeOutlineRegular, IconRefreshOutlineRegular, } from '@deepseek-ai/dsh-client-ui-primitives';
/** 0.2.0 起宿主只导出 Regular / Medium，不再提供带尺寸后缀的旧名。 */
export const IconGauge = IconGaugeOutlineRegular;
/** 未开启时用电源符号，16 像素下和表盘分得开，也不划过文字。 */
export function IconGaugeOff({ size = 16, className }) {
    return h('svg', { width: size, height: size, className, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }, h('path', { d: 'M8 1.6V6.6' }), h('path', { d: 'M5.15 3.85a4.7 4.7 0 1 0 5.7 0' }));
}
export const IconClose = IconCloseOutlineRegular;
export const IconChevronDown = IconChevronDownOutlineRegular;
export const IconChevronUp = IconChevronUpOutlineRegular;
export const IconRefresh = IconRefreshOutlineRegular;
//# sourceMappingURL=icons.js.map