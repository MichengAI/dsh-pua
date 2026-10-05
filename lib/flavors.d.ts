/** 风味白名单与原版章节对应关系；任何用户输入都不能直接构造素材路径。 */
export declare const FLAVORS: readonly [{
    readonly id: "alibaba";
    readonly label: "阿里";
    readonly aliases: readonly ["阿里", "阿里巴巴"];
    readonly chapter: 1;
}, {
    readonly id: "bytedance";
    readonly label: "字节";
    readonly aliases: readonly ["字节", "字节跳动"];
    readonly chapter: 2;
}, {
    readonly id: "huawei";
    readonly label: "华为";
    readonly aliases: readonly ["华为"];
    readonly chapter: 3;
}, {
    readonly id: "tencent";
    readonly label: "腾讯";
    readonly aliases: readonly ["腾讯"];
    readonly chapter: 4;
}, {
    readonly id: "baidu";
    readonly label: "百度";
    readonly aliases: readonly ["百度"];
    readonly chapter: 5;
}, {
    readonly id: "pinduoduo";
    readonly label: "拼多多";
    readonly aliases: readonly ["拼多多"];
    readonly chapter: 6;
}, {
    readonly id: "meituan";
    readonly label: "美团";
    readonly aliases: readonly ["美团"];
    readonly chapter: 7;
}, {
    readonly id: "jd";
    readonly label: "京东";
    readonly aliases: readonly ["京东"];
    readonly chapter: 8;
}, {
    readonly id: "xiaomi";
    readonly label: "小米";
    readonly aliases: readonly ["小米"];
    readonly chapter: 9;
}, {
    readonly id: "netflix";
    readonly label: "Netflix";
    readonly aliases: readonly ["奈飞"];
    readonly chapter: 10;
}, {
    readonly id: "tesla";
    readonly label: "Musk";
    readonly aliases: readonly ["musk", "马斯克", "特斯拉"];
    readonly chapter: 11;
}, {
    readonly id: "apple";
    readonly label: "Jobs";
    readonly aliases: readonly ["jobs", "乔布斯", "苹果"];
    readonly chapter: 12;
}, {
    readonly id: "amazon";
    readonly label: "Amazon";
    readonly aliases: readonly ["亚马逊"];
    readonly chapter: 13;
}, {
    readonly id: "microsoft";
    readonly label: "Microsoft";
    readonly aliases: readonly ["微软"];
    readonly chapter: 14;
}, {
    readonly id: "ding";
    readonly label: "钉内/钉外";
    readonly aliases: readonly ["钉味", "钉钉", "钉内", "钉外"];
    readonly chapter: 15;
}];
export type FlavorId = (typeof FLAVORS)[number]['id'];
/** 解析公开标识或别名；未知名称返回 undefined。 */
export declare function resolveFlavor(value: string): FlavorId | undefined;
export declare function flavorLabel(id: FlavorId): string;
export declare function listFlavors(): string;
