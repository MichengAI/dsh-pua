import type { ReactNode } from 'react';
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives';

type Icon = (props: { size?: number; className?: string }) => ReactNode;

/** 0.1.7 导出 Regular；0.1.6 仍用带尺寸后缀的旧名。都没有时渲染为空。 */
export function hostIcon(...names: string[]): Icon {
  const bag = primitives as Record<string, unknown>;
  for (const name of names) {
    const icon = bag[name];
    if (typeof icon === 'function') return icon as Icon;
  }
  return () => null;
}

export const IconGauge = hostIcon('IconGaugeOutlineRegular', 'IconGaugeOutline16');
export const IconClose = hostIcon('IconCloseOutlineRegular', 'IconCloseOutline16');
export const IconChevronDown = hostIcon('IconChevronDownOutlineRegular', 'IconChevronDownOutline14');
export const IconChevronUp = hostIcon('IconChevronUpOutlineRegular', 'IconChevronUpOutline14');
