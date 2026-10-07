import { createElement as h } from 'react';
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives';
/** 0.1.7 导出 Regular；0.1.6 仍用带尺寸后缀的旧名。都没有时渲染为空。 */
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
/** 未开启时用电源符号，16 像素下和表盘分得开，也不划过文字。 */
export function IconGaugeOff({ size = 16, className }) {
    return h('svg', { width: size, height: size, className, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }, h('path', { d: 'M8 1.6V6.6' }), h('path', { d: 'M5.15 3.85a4.7 4.7 0 1 0 5.7 0' }));
}
export const IconClose = hostIcon('IconCloseOutlineRegular', 'IconCloseOutline16');
export const IconChevronDown = hostIcon('IconChevronDownOutlineRegular', 'IconChevronDownOutline14');
export const IconChevronUp = hostIcon('IconChevronUpOutlineRegular', 'IconChevronUpOutline14');
//# sourceMappingURL=icons.js.map