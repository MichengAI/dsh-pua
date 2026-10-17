/** Flavor allowlist and its mapping to original chapters; user input can never construct a material path directly. */
export declare const FLAVORS: readonly [{
    readonly id: "alibaba";
    readonly label: "Alibaba";
    readonly aliases: readonly ["alibaba", "ali", "ali-baba", "阿里", "阿里巴巴"];
    readonly chapter: 1;
}, {
    readonly id: "bytedance";
    readonly label: "ByteDance";
    readonly aliases: readonly ["bytedance", "byte", "douyin", "tiktok", "字节", "字节跳动"];
    readonly chapter: 2;
}, {
    readonly id: "huawei";
    readonly label: "Huawei";
    readonly aliases: readonly ["huawei", "华为"];
    readonly chapter: 3;
}, {
    readonly id: "tencent";
    readonly label: "Tencent";
    readonly aliases: readonly ["tencent", "腾讯"];
    readonly chapter: 4;
}, {
    readonly id: "baidu";
    readonly label: "Baidu";
    readonly aliases: readonly ["baidu", "百度"];
    readonly chapter: 5;
}, {
    readonly id: "pinduoduo";
    readonly label: "Pinduoduo";
    readonly aliases: readonly ["pinduoduo", "pdd", "拼多多"];
    readonly chapter: 6;
}, {
    readonly id: "meituan";
    readonly label: "Meituan";
    readonly aliases: readonly ["meituan", "美团"];
    readonly chapter: 7;
}, {
    readonly id: "jd";
    readonly label: "JD";
    readonly aliases: readonly ["jd", "京东"];
    readonly chapter: 8;
}, {
    readonly id: "xiaomi";
    readonly label: "Xiaomi";
    readonly aliases: readonly ["xiaomi", "mi", "小米"];
    readonly chapter: 9;
}, {
    readonly id: "netflix";
    readonly label: "Netflix";
    readonly aliases: readonly ["netflix", "奈飞"];
    readonly chapter: 10;
}, {
    readonly id: "tesla";
    readonly label: "Musk";
    readonly aliases: readonly ["musk", "tesla", "马斯克", "特斯拉"];
    readonly chapter: 11;
}, {
    readonly id: "apple";
    readonly label: "Jobs";
    readonly aliases: readonly ["jobs", "apple", "乔布斯", "苹果"];
    readonly chapter: 12;
}, {
    readonly id: "amazon";
    readonly label: "Amazon";
    readonly aliases: readonly ["amazon", "亚马逊"];
    readonly chapter: 13;
}, {
    readonly id: "microsoft";
    readonly label: "Microsoft";
    readonly aliases: readonly ["microsoft", "ms", "微软"];
    readonly chapter: 14;
}, {
    readonly id: "ding";
    readonly label: "Ding-inside/Ding-outside";
    readonly aliases: readonly ["ding", "钉味", "钉钉", "钉内", "钉外"];
    readonly chapter: 15;
}];
export type FlavorId = (typeof FLAVORS)[number]['id'];
/** Resolves a public id or alias; returns undefined for an unknown name. */
export declare function resolveFlavor(value: string): FlavorId | undefined;
export declare function flavorLabel(id: FlavorId): string;
export declare function listFlavors(): string;
