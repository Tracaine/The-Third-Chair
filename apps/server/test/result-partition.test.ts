import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toMcpResult } from "@third-chair/server";

const outputSchema = z.object({ answer: z.string() }).strict();

describe("player-safe MCP result partitioning", () => {
  it("validates structured content and caps model-visible text", () => {
    expect(() => toMcpResult(outputSchema, { answer: 42 }, "nope")).toThrow();
    const result = toMcpResult(outputSchema, { answer: "safe" }, "x".repeat(2_100));
    expect(result.content).toEqual([{ type: "text", text: "x".repeat(2_000) }]);
  });

  it.each(["structuredContent", "content", "_meta"] as const)("rejects sentinels in %s", (partition) => {
    const secret = "DIRECTOR_SECRET_SENTINEL";
    const structured = partition === "structuredContent" ? { answer: secret } : { answer: "safe" };
    const content = partition === "content" ? secret : "safe";
    const meta = partition === "_meta" ? { accessibleLabel: secret } : {};
    expect(() => toMcpResult(outputSchema, structured, content, meta)).toThrow(/Forbidden sentinel/);
  });

  it("rejects forbidden keys even inside widget metadata", () => {
    expect(() => toMcpResult(outputSchema, { answer: "safe" }, "safe", {
      panel: { hidden: "not a vault" },
    })).toThrow(/Forbidden result key/);
  });
});
