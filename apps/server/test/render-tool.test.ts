import { describe, expect, it } from "vitest";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";
import { sha256Json } from "@third-chair/engine";
import { createCampaignRepository, createTurnRepository } from "@third-chair/storage";
import {
  beginInput,
  checkResolution,
  committedCandidate,
  createTempDatabase,
  resolutionPlan,
  seedCampaign,
  turnProposal,
} from "@third-chair/storage/test/fixtures";
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
      const turns = createTurnRepository(temp.db);
      const state = structuredClone(minimumWorldState);
      const stateHash = sha256Json(state);
      campaigns.createCampaign({ id: state.metadata.campaignId, ownerId: "test_owner", name: "Lanterns", sourcePackHash: "fixture", rngSeed: new Uint8Array(32), currentState: state, currentStateHash: stateHash, rootBranchId: "test_branch_render", rootBranchLabel: "Main" });
      const currentId = computePlayerViewId(state.metadata.campaignId, 0, "RAVEN", stateHash);
      const result = renderTable({ campaigns, turns }, { campaignId: state.metadata.campaignId, audience: "RAVEN", playerViewId: currentId });
      expect(result.structuredContent).toMatchObject({
        playerViewId: currentId,
        playerView: { campaignId: state.metadata.campaignId, stateVersion: 0 },
        visibleChecks: [],
        serverStatus: "READY",
      });

      expect(() => renderTable({ campaigns, turns }, { campaignId: state.metadata.campaignId, audience: "RAVEN", playerViewId: "0".repeat(64) }))
        .toThrow(StalePlayerViewError);
      try {
        renderTable({ campaigns, turns }, { campaignId: state.metadata.campaignId, audience: "RAVEN", playerViewId: "0".repeat(64) });
      } catch (error) {
        expect(error).toMatchObject({ code: "STALE_PLAYER_VIEW", currentStateVersion: 0, freshPlayerViewId: currentId });
      }
    } finally { temp.close(); temp.cleanup(); }
  });

  it("projects recent public checks, their narration consequence, and the latest mutation", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "render_history");
      const campaigns = createCampaignRepository(temp.db);
      const turns = createTurnRepository(temp.db);
      const input = beginInput("render_history");
      turns.beginTurn(input);
      const plan = resolutionPlan("render_history");
      turns.persistPlan(input.turnId, plan);
      const publicCheck = checkResolution("render_public", plan.id);
      const secretCheck = { ...checkResolution("render_secret", plan.id), visibility: "SECRET" as const };
      turns.persistResolutions(input.turnId, [publicCheck, secretCheck], 1);
      const { candidate, nextDecision } = committedCandidate(seeded.state, "render_history", 1);
      turns.persistProposal(input.turnId, turnProposal(nextDecision), candidate);
      turns.commitTurn({
        turnId: input.turnId,
        candidateStateHash: "state-hash-render-history-1",
        narration: { sceneText: "The latch yields before the patrol arrives." },
        nextDecision,
      });

      const current = campaigns.getCampaign(seeded.campaignId);
      const currentId = computePlayerViewId(current.id, current.stateVersion, "BILL", current.currentStateHash);
      const result = renderTable({ campaigns, turns }, { campaignId: current.id, audience: "BILL", playerViewId: currentId });

      expect(result.structuredContent).toMatchObject({
        lastMutationId: input.turnId,
        visibleChecks: [{
          id: publicCheck.id,
          visibility: "PUBLIC",
          consequence: "The latch yields before the patrol arrives.",
        }],
      });
      expect(JSON.stringify(result)).not.toContain(secretCheck.id);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});
