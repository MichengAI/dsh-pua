/** 风味白名单与原版章节对应关系；任何用户输入都不能直接构造素材路径。 */
export const FLAVORS = [
  { id: 'alibaba', label: '阿里', aliases: ['阿里', '阿里巴巴'], chapter: 1 },
  { id: 'bytedance', label: '字节', aliases: ['字节', '字节跳动'], chapter: 2 },
  { id: 'huawei', label: '华为', aliases: ['华为'], chapter: 3 },
  { id: 'tencent', label: '腾讯', aliases: ['腾讯'], chapter: 4 },
  { id: 'baidu', label: '百度', aliases: ['百度'], chapter: 5 },
  { id: 'pinduoduo', label: '拼多多', aliases: ['拼多多'], chapter: 6 },
  { id: 'meituan', label: '美团', aliases: ['美团'], chapter: 7 },
  { id: 'jd', label: '京东', aliases: ['京东'], chapter: 8 },
  { id: 'xiaomi', label: '小米', aliases: ['小米'], chapter: 9 },
  { id: 'netflix', label: 'Netflix', aliases: ['奈飞'], chapter: 10 },
  { id: 'tesla', label: 'Musk', aliases: ['musk', '马斯克', '特斯拉'], chapter: 11 },
  { id: 'apple', label: 'Jobs', aliases: ['jobs', '乔布斯', '苹果'], chapter: 12 },
  { id: 'amazon', label: 'Amazon', aliases: ['亚马逊'], chapter: 13 },
  { id: 'microsoft', label: 'Microsoft', aliases: ['微软'], chapter: 14 },
  { id: 'ding', label: '钉内/钉外', aliases: ['钉味', '钉钉', '钉内', '钉外'], chapter: 15 },
] as const;

export type FlavorId = (typeof FLAVORS)[number]['id'];

/** 解析公开标识或别名；未知名称返回 undefined。 */
export function resolveFlavor(value: string): FlavorId | undefined {
  const normalized = value.toLowerCase();
  return FLAVORS.find(item => item.id === normalized || item.aliases.some(alias => alias === normalized))?.id;
}

export function flavorLabel(id: FlavorId): string {
  return FLAVORS.find(item => item.id === id)!.label;
}

export function listFlavors(): string {
  return FLAVORS.map(item => `${item.id}（${item.label}）`).join('、');
}
