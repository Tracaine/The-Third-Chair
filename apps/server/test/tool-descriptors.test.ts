import { describe, expect, it } from "vitest";
import { advanceGameDescriptor, getTableViewDescriptor } from "@third-chair/server";
describe("player MCP descriptors", () => it("advertises safe annotations", () => {
  expect(getTableViewDescriptor.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true });
  expect(advanceGameDescriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true });
}));
