export interface ToolResult {
    readonly content: readonly {
        readonly type: "text";
        readonly text: string;
    }[];
    readonly structuredContent: unknown;
    readonly _meta: Record<string, unknown>;
}
export declare function playerResult(status: string, structuredContent: unknown, meta?: Record<string, unknown>): ToolResult;
//# sourceMappingURL=result.d.ts.map