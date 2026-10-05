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
export const IconClose = hostIcon('IconCloseOutlineRegular', 'IconCloseOutline16');
export const IconChevronDown = hostIcon('IconChevronDownOutlineRegular', 'IconChevronDownOutline14');
export const IconChevronUp = hostIcon('IconChevronUpOutlineRegular', 'IconChevronUpOutline14');
//# sourceMappingURL=icons.js.map