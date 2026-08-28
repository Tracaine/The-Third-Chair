import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolResult = CallToolResult & {
  structuredContent: Record<string, unknown>;
  _meta: Record<string, unknown>;
};

function requireStructuredObject(
  value: unknown,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("STRUCTURED_CONTENT_MUST_BE_OBJECT");
  }

  return value as Record<string, unknown>;
}

export function playerResult(
  status: string,
  structuredContent: unknown,
  meta: Record<string, unknown> = {},
): ToolResult {
  return {
    content: [{ type: "text", text: status }],
    structuredContent: requireStructuredObject(structuredContent),
    _meta: meta,
  };
}