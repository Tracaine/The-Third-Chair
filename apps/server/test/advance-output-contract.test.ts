import { describe, expect, it } from "vitest";
import { AdvanceGameOutputSchema } from "@third-chair/contracts";
import { billIntent, minimumWorldState, ravenIntent } from "@third-chair/contracts/test/fixtures";
import { createTurnEngine, FakeDirector, FakeNarrator, projectPlayerView, sha256Json } from "@third-chair/engine";
import { advanceGame } from "@third-chair/server";
import { createCampaignRepository, createTurnRepository } from "@third-chair/storage";
import { createTempDatabase } from "@third-chair/storage/test/fixtures";

describe("advance_game player-safe output", () => {
  it("hands a committed scene back for narration in the same reply when Bill acts next", async () => {
    const temp = createTempDatabase();
    try {
      const state = structuredClone(minimumWorldState);
      const campaignId = state.metadata.campaignId;
      const campaigns = createCampaignRepository(temp.db);
      campaigns.createCampaign({
        id: campaignId, ownerId: "test_owner", name: "Test", sourcePackHash: "fixture",
        rngSeed: new Uint8Array(32), currentState: state, currentStateHash: sha256Json(state),
        rootBranchId: "test_branch", rootBranchLabel: "Main",
      });
      const sceneText = "The door swings open onto a narrow stair.";
      const engine = createTurnEngine({
        campaigns, turns: createTurnRepository(temp.db),
        director: new FakeDirector(({ state }) => ({
          uncontestedOperations: [], checkLinkedOperations: [], memoryWrites: [], riskTags: [],
          nextDecision: { ...state.currentDecision, id: "test_next_bill", owner: "BILL",
            eligibleActorIds: ["test_actor_bill"], situation: "A narrow stair leads down." },
          narrativeBrief: { summary: sceneText, requiredResolutionIds: [], requiredEventIds: [] },
        })),
        narrator: new FakeNarrator(() => ({
          sceneText, spokenNpcLines: [], mustIncludeResolutionIds: [], mustIncludeEventIds: [], visibleEventIds: [],
        })),
      });
      const result = await advanceGame({ engine }, {
        kind: "INTENTS", campaignId, expectedStateVersion: 0, decisionId: state.currentDecision.id,
        clientRequestId: "test_narration_handoff", intents: [billIntent, ravenIntent],
      });

      expect(result.structuredContent).toMatchObject({
        kind: "COMMITTED", narration: { sceneText }, nextDecision: { owner: "BILL" },
      });
      expect(result.content).toContainEqual({ type: "text", text: expect.stringMatching(/narrate .*this reply/i) });
    } finally { temp.close(); temp.cleanup(); }
  });

  it("accepts a Raven view whose next Bill-owned decision hides owner-only fields", () => {
    const state = structuredClone(minimumWorldState);
    state.currentDecision = { ...state.currentDecision, owner: "BILL", eligibleActorIds: ["test_actor_bill"] };
    const view = projectPlayerView(state, "RAVEN");
    expect(view.currentDecision.eligibleActorIds).toBeUndefined();
    expect(AdvanceGameOutputSchema.safeParse({
      kind: "COMMITTED",
      lockedIntents: [],
      visibleRolls: [],
      narration: null,
      currentStatus: { stateVersion: view.stateVersion },
      nextDecision: view.currentDecision,
      view,
    }).success).toBe(true);
  });

  it("rejects unstructured narration at the player-safe output boundary", () => {
    const view = projectPlayerView(minimumWorldState, "RAVEN");
    expect(AdvanceGameOutputSchema.safeParse({
      kind: "COMMITTED",
      lockedIntents: [],
      visibleRolls: [],
      narration: "unbounded narration",
      currentStatus: { stateVersion: view.stateVersion },
      nextDecision: view.currentDecision,
      view,
    }).success).toBe(false);
  });
});
