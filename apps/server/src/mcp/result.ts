export interface ToolResult { readonly content: readonly { readonly type: "text"; readonly text: string }[]; readonly structuredContent: unknown; readonly _meta: Record<string, unknown>; }
export function playerResult(status: string, structuredContent: unknown, meta: Record<string, unknown> = {}): ToolResult {
  return { content: [{ type: "text", text: status }], structuredContent, _meta: meta };
}
