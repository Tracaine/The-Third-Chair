import { describe, expect, it } from "vitest";
import { createMcpServer } from "@third-chair/server";
import { createCampaignRepository, createCheckpointRepository, createTurnRepository } from "@third-chair/storage";
import { createTempDatabase, seedCampaign } from "@third-chair/storage/test/fixtures";

describe("widget lifecycle actions through the MCP boundary", () => {
  it("rejects stale checkpoint versions and makes repeated request IDs idempotent", async () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "widget_checkpoint");
      const mcp = createMcpServer({
        campaigns: createCampaignRepository(temp.db),
        checkpoints: createCheckpointRepository(temp.db),
        turns: createTurnRepository(temp.db),
        engine: {} as never,
      });
      const input = {
        campaignId: seeded.campaignId,
        requestId: "test_request_widget_checkpoint",
        expectedStateVersion: 0,
        label: "Before opening the vault",
      };

      await expect(mcp.invoke("create_checkpoint", { ...input, expectedStateVersion: 1 }))
        .rejects.toThrow("STATE_VERSION_CONFLICT");
      const created = await mcp.invoke("create_checkpoint", input);
      await expect(mcp.invoke("create_checkpoint", input)).resolves.toEqual(created);
      await expect(mcp.invoke("create_checkpoint", { ...input, label: "A different moment" }))
        .rejects.toThrow("CHECKPOINT_IDEMPOTENCY_CONFLICT");
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("commits confirmed rewind once and rejects stale or reused requests", async () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "widget_rewind");
      const checkpoints = createCheckpointRepository(temp.db);
      const mcp = createMcpServer({
        campaigns: createCampaignRepository(temp.db),
        checkpoints,
        turns: createTurnRepository(temp.db),
        engine: {} as never,
      });
      const [campaignStart] = checkpoints.list(seeded.campaignId);
      const alternate = checkpoints.createNamed({
        checkpointId: "test_checkpoint_widget_rewind_alternate",
        campaignId: seeded.campaignId,
        requestId: "test_request_widget_rewind_alternate_checkpoint",
        expectedStateVersion: 0,
        label: "Alternate checkpoint",
      });
      const input = {
        campaignId: seeded.campaignId,
        checkpointId: campaignStart!.id,
        requestId: "test_request_widget_rewind",
        expectedStateVersion: 0,
        confirmed: true,
      };

      const rewound = await mcp.invoke("rewind_to_checkpoint", input);
      await expect(mcp.invoke("rewind_to_checkpoint", input)).resolves.toEqual(rewound);
      await expect(mcp.invoke("rewind_to_checkpoint", { ...input, checkpointId: alternate.id }))
        .rejects.toThrow("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT");
      await expect(mcp.invoke("rewind_to_checkpoint", {
        ...input,
        requestId: "test_request_widget_rewind_stale",
      })).rejects.toThrow("STATE_VERSION_CONFLICT");
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});
