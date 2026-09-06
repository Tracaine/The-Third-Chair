import { describe, expect, it, vi } from "vitest";
import { advanceGame, advanceGameDescriptor, getTableViewDescriptor } from "@third-chair/server";
import type { TurnEngine } from "@third-chair/engine";
describe("player MCP descriptors", () => it("advertises safe annotations", () => {
  expect(getTableViewDescriptor.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true });
  expect(advanceGameDescriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true });
}));

it("accepts a narration-recovery command through the public advance_game boundary", async () => {
  const input = { kind: "NARRATION_RECOVERY", campaignId: "test_campaign", expectedStateVersion: 0,
    decisionId: "test_recovery_decision", clientRequestId: "test_recovery_request",
    turnId: "test_turn", acceptTerseRendering: true } as const;
  const invoke = vi.fn(async () => { throw new Error("STOP_AFTER_PUBLIC_PARSE"); });

  await expect(advanceGame({ engine: { advanceGame: invoke } as unknown as TurnEngine }, input))
    .rejects.toThrow("STOP_AFTER_PUBLIC_PARSE");
  expect(invoke).toHaveBeenCalledWith(input);
  expect(advanceGameDescriptor.description).toContain("recovery");
});
