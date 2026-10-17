/** Flavor allowlist and its mapping to original chapters; user input can never construct a material path directly. */
export const FLAVORS = [
    { id: 'alibaba', label: 'Alibaba', aliases: ['alibaba', 'ali', 'ali-baba', '阿里', '阿里巴巴'], chapter: 1 },
    { id: 'bytedance', label: 'ByteDance', aliases: ['bytedance', 'byte', 'douyin', 'tiktok', '字节', '字节跳动'], chapter: 2 },
    { id: 'huawei', label: 'Huawei', aliases: ['huawei', '华为'], chapter: 3 },
    { id: 'tencent', label: 'Tencent', aliases: ['tencent', '腾讯'], chapter: 4 },
    { id: 'baidu', label: 'Baidu', aliases: ['baidu', '百度'], chapter: 5 },
    { id: 'pinduoduo', label: 'Pinduoduo', aliases: ['pinduoduo', 'pdd', '拼多多'], chapter: 6 },
    { id: 'meituan', label: 'Meituan', aliases: ['meituan', '美团'], chapter: 7 },
    { id: 'jd', label: 'JD', aliases: ['jd', '京东'], chapter: 8 },
    { id: 'xiaomi', label: 'Xiaomi', aliases: ['xiaomi', 'mi', '小米'], chapter: 9 },
    { id: 'netflix', label: 'Netflix', aliases: ['netflix', '奈飞'], chapter: 10 },
    { id: 'tesla', label: 'Musk', aliases: ['musk', 'tesla', '马斯克', '特斯拉'], chapter: 11 },
    { id: 'apple', label: 'Jobs', aliases: ['jobs', 'apple', '乔布斯', '苹果'], chapter: 12 },
    { id: 'amazon', label: 'Amazon', aliases: ['amazon', '亚马逊'], chapter: 13 },
    { id: 'microsoft', label: 'Microsoft', aliases: ['microsoft', 'ms', '微软'], chapter: 14 },
    { id: 'ding', label: 'Ding-inside/Ding-outside', aliases: ['ding', '钉味', '钉钉', '钉内', '钉外'], chapter: 15 },
];
/** Resolves a public id or alias; returns undefined for an unknown name. */
export function resolveFlavor(value) {
    const normalized = value.trim().toLowerCase();
    return FLAVORS.find(item => item.id === normalized || item.aliases.some(alias => alias.toLowerCase() === normalized))?.id;
}
export function flavorLabel(id) {
    return FLAVORS.find(item => item.id === id).label;
}
export function listFlavors() {
    return FLAVORS.map(item => `${item.id} (${item.label})`).join(', ');
}
//# sourceMappingURL=flavors.js.map