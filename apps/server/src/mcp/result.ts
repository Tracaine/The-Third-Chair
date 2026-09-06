import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

export type ToolResult = CallToolResult & {
  structuredContent: Record<string, unknown>;
  _meta: Record<string, unknown>;
};

function requireStructuredObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("STRUCTURED_CONTENT_MUST_BE_OBJECT");
  }

  return value as Record<string, unknown>;
}

const forbiddenKeys = new Set(["secret", "hidden", "director", "adventureSpine", "rngSeed", "rawSourceText"]);
const forbiddenSentinels = ["DIRECTOR_SECRET_SENTINEL", "HIDDEN_SENTINEL", "SENTINEL_SECRET"];

function assertSafeResult(value: unknown): void {
  const visit = (candidate: unknown): void => {
    if (typeof candidate === "string") {
      const sentinel = forbiddenSentinels.find((item) => candidate.includes(item));
      if (sentinel) throw new Error(`Forbidden sentinel in MCP result: ${sentinel}`);
      return;
    }
    if (Array.isArray(candidate)) return candidate.forEach(visit);
    if (candidate !== null && typeof candidate === "object") {
      for (const [key, nested] of Object.entries(candidate)) {
        if (forbiddenKeys.has(key)) throw new Error(`Forbidden result key: ${key}`);
        visit(nested);
      }
    }
  };
  visit(value);
}

export function toMcpResult<T extends Record<string, unknown>>(
  outputSchema: z.ZodType<T>,
  structuredContent: unknown,
  status: string,
  meta: Record<string, unknown> = {},
): ToolResult {
  const parsed = outputSchema.parse(structuredContent);
  const content = status.slice(0, 2_000);
  assertSafeResult(parsed);
  assertSafeResult(content);
  assertSafeResult(meta);
  return {
    content: [{ type: "text", text: content }],
    structuredContent: requireStructuredObject(parsed),
    _meta: meta,
  };
}

export function playerResult(
  status: string,
  structuredContent: unknown,
  meta: Record<string, unknown> = {},
): ToolResult {
  assertSafeResult(structuredContent);
  assertSafeResult(status);
  assertSafeResult(meta);
  return {
    content: [{ type: "text", text: status.slice(0, 2_000) }],
    structuredContent: requireStructuredObject(structuredContent),
    _meta: meta,
  };
}
