import { describe, expect, it } from "vitest";
import * as server from "@third-chair/server";
import { createCampaignRepository, createCheckpointRepository } from "@third-chair/storage";
import { createTempDatabase, seedCampaign } from "@third-chair/storage/test/fixtures";

describe("checkpoint MCP tools", () => {
  it("creates an idempotent named checkpoint without exposing its private state", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "checkpoint_tool");
      expect(server.createCheckpointDescriptor).toBeDefined();
      expect(server.createCheckpoint).toBeTypeOf("function");
      if (!server.createCheckpointDescriptor || !server.createCheckpoint) return;
      expect(server.createCheckpointDescriptor.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      });
      const input = {
        campaignId: seeded.campaignId,
        requestId: "test_request_checkpoint_tool",
        expectedStateVersion: 0,
        label: "Before knocking",
      };
      const deps = {
        checkpoints: createCheckpointRepository(temp.db),
        newCheckpointId: () => "test_checkpoint_tool",
      };

      const created = server.createCheckpoint(deps, input);
      expect(server.createCheckpoint(deps, input)).toEqual(created);
      expect(created.structuredContent).toMatchObject({
        checkpoint: { id: "test_checkpoint_tool", label: "Before knocking", stateVersion: 0 },
      });
      expect(JSON.stringify(created)).not.toMatch(/stateHash|rngCounter|currentState|actors/);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("requires confirmation for destructive rewind and returns only table-control results", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "rewind_tool");
      const campaigns = createCampaignRepository(temp.db);
      const checkpoints = createCheckpointRepository(temp.db);
      const campaignStart = checkpoints.list(seeded.campaignId)[0]!;
      expect(server.rewindToCheckpointDescriptor).toBeDefined();
      expect(server.rewindToCheckpoint).toBeTypeOf("function");
      if (!server.rewindToCheckpointDescriptor || !server.rewindToCheckpoint) return;
      expect(server.rewindToCheckpointDescriptor.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
        idempotentHint: true,
      });
      const input = {
        campaignId: seeded.campaignId,
        checkpointId: campaignStart.id,
        requestId: "test_request_rewind_tool",
        expectedStateVersion: 0,
        confirmed: true as const,
      };
      const deps = {
        campaigns,
        checkpoints,
        newTurnId: () => "test_turn_rewind_tool",
        newBranchId: () => "test_branch_rewind_tool_new",
        newDecisionId: () => "test_decision_rewind_tool_new",
      };

      expect(() => server.rewindToCheckpoint(deps, { ...input, confirmed: false } as never)).toThrow();
      const result = server.rewindToCheckpoint(deps, input);
      expect(result.structuredContent).toMatchObject({
        checkpoint: { id: campaignStart.id, label: "Campaign Start", stateVersion: 0 },
        abandonedBranchId: seeded.rootBranchId,
        activeBranchId: "test_branch_rewind_tool_new",
        stateVersion: 1,
        currentDecision: { id: "test_decision_rewind_tool_new", owner: "BOTH" },
      });
      expect(result.structuredContent.playerViewId).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(result)).not.toMatch(/rngSeed|rngCounter|currentState|stateHash/);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("registers both tools on the in-process MCP surface", () => {
    const mcp = server.createMcpServer({
      campaigns: {} as never,
      turns: {} as never,
      checkpoints: {} as never,
      engine: {} as never,
    });
    expect(mcp.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "create_checkpoint",
      "rewind_to_checkpoint",
    ]));
  });
});
