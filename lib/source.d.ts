/** Pinned original tree for a fixed Git commit; every path offered to the model must hit the allowlist. */
export declare class SourceCatalog {
    readonly revision: string;
    private readonly documents;
    constructor();
    list(): readonly string[];
    /** Returns the full original text; an unknown path fails instead of turning input into an arbitrary file path. */
    read(path: string): string;
    body(path: string): string;
}
