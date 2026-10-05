export interface IntegrityHit {
    readonly decision: "deny" | "advisory";
    readonly reason: string;
    readonly target: string;
}
export declare const INTEGRITY_DENIED_CODE = "PUA_INTEGRITY_GUARD_DENIED";
export declare function classifyToolCall(name: string, args: unknown): IntegrityHit | null;
export declare function integrityDenyReason(hit: IntegrityHit): string;
export declare function integrityContext(hit: IntegrityHit): string;
