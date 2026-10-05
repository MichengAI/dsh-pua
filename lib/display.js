export const MODE_NAMES = {
    zh: { pua: '普通 · 持续推进与证据交付', p7: 'P7 · 方案驱动', p9: 'P9 · 技术负责人', p10: 'P10 · 战略规划', pro: 'Pro · 自进化', yes: 'Yes · 鼓励', mama: 'Mama · 关怀', shot: 'Shot · 激励', 'pua-en': '英文协议', 'pua-ja': '日文协议' },
    en: { pua: 'Standard · steady progress and evidence', p7: 'P7 · plan-driven', p9: 'P9 · tech lead', p10: 'P10 · strategy', pro: 'Pro · self-improving', yes: 'Yes · encouragement', mama: 'Mama · caring', shot: 'Shot · motivation', 'pua-en': 'English protocol', 'pua-ja': 'Japanese protocol' },
};
export function modeName(mode, lang) { return MODE_NAMES[lang][mode] ?? mode; }
//# sourceMappingURL=display.js.map