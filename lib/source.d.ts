/** 固定 Git 提交的原版目录；提供给模型的路径必须命中白名单。 */
export declare class SourceCatalog {
    readonly revision: string;
    private readonly documents;
    constructor();
    list(): readonly string[];
    /** 返回完整原文；未知路径失败，不将输入转换为任意文件路径。 */
    read(path: string): string;
    body(path: string): string;
}
