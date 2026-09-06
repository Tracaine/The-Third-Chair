import { describe, expect, it } from "vitest";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";
import { sha256Json } from "@third-chair/engine";
import { createCampaignRepository } from "@third-chair/storage";
import { createTempDatabase } from "@third-chair/storage/test/fixtures";
import { computePlayerViewId, renderTable, renderTableDescriptor, StalePlayerViewError } from "@third-chair/server";

describe("render_table", () => {
  it("is a read-only idempotent UI attachment", () => {
    expect(renderTableDescriptor.annotations).toEqual({
      readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true,
    });
    expect(renderTableDescriptor._meta).toEqual(expect.objectContaining({
      ui: { resourceUri: "ui://third-chair/table-v1.html" },
      "openai/outputTemplate": "ui://third-chair/table-v1.html",
      "openai/toolInvocation/invoking": "Setting the table…",
      "openai/toolInvocation/invoked": "The table is ready",
    }));
  });

  it("recomputes the authoritative view and rejects stale IDs with the fresh version", () => {
    const temp = createTempDatabase();
    try {
      const campaigns = createCampaignRepository(temp.db);
      const state = structuredClone(minimumWorldState);
      const stateHash = sha256Json(state);
      campaigns.createCampaign({ id: state.metadata.campaignId, ownerId: "test_owner", name: "Lanterns", sourcePackHash: "fixture", rngSeed: new Uint8Array(32), currentState: state, currentStateHash: stateHash, rootBranchId: "test_branch_render", rootBranchLabel: "Main" });
      const currentId = computePlayerViewId(state.metadata.campaignId, 0, "RAVEN", stateHash);
      const result = renderTable({ campaigns }, { campaignId: state.metadata.campaignId, audience: "RAVEN", playerViewId: currentId });
      expect(result.structuredContent).toMatchObject({
        playerViewId: currentId,
        playerView: { campaignId: state.metadata.campaignId, stateVersion: 0 },
        visibleChecks: [],
        serverStatus: "READY",
      });

      expect(() => renderTable({ campaigns }, { campaignId: state.metadata.campaignId, audience: "RAVEN", playerViewId: "0".repeat(64) }))
        .toThrow(StalePlayerViewError);
      try {
        renderTable({ campaigns }, { campaignId: state.metadata.campaignId, audience: "RAVEN", playerViewId: "0".repeat(64) });
      } catch (error) {
        expect(error).toMatchObject({ code: "STALE_PLAYER_VIEW", currentStateVersion: 0, freshPlayerViewId: currentId });
      }
    } finally { temp.close(); temp.cleanup(); }
  });
});
