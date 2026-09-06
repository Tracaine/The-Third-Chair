import type { TurnProposal } from "@third-chair/contracts";
import { createCampaignRepository, createTurnRepository } from "@third-chair/storage";
import { createTempDatabase, worldState } from "@third-chair/storage/test/fixtures";
import { createTurnEngine, FakeDirector, FakeNarrator, sha256Json } from "@third-chair/engine";
import { describe, expect, it } from "vitest";

function proposal(state: ReturnType<typeof worldState>, invalid: boolean): TurnProposal {
  return {
    uncontestedOperations: invalid ? [{
      id: "test_invalid_move", kind: "MOVE_ACTOR", reason: "The model chose an unknown location.",
      audience: "PARTY", cause: { type: "UNCONTESTED", intentActorId: "test_actor_bill" },
      actorId: "test_actor_bill", locationId: "test_missing_location",
    }] : [],
    checkLinkedOperations: [], memoryWrites: [], riskTags: [],
    nextDecision: { ...state.currentDecision, id: "test_next_after_repair", stateVersion: 999 },
    narrativeBrief: { summary: "The moment continues.", requiredResolutionIds: [], requiredEventIds: [] },
  };
}

function setup(suffix: string, repairIsValid: boolean) {
  const temp = createTempDatabase();
  const state = worldState(suffix);
  const campaigns = createCampaignRepository(temp.db);
  const turns = createTurnRepository(temp.db);
  campaigns.createCampaign({ id: state.metadata.campaignId, ownerId: "test_owner", name: "Test campaign",
    sourcePackHash: "test-source-pack", rngSeed: new Uint8Array(32), currentState: state,
    currentStateHash: sha256Json(state), rootBranchId: `test_branch_${suffix}`, rootBranchLabel: "Main" });
  const director = new FakeDirector(() => proposal(state, true), () => proposal(state, !repairIsValid));
  const narrator = new FakeNarrator((input) => ({ sceneText: "The repaired result.", spokenNpcLines: [],
    mustIncludeResolutionIds: input.proposal.narrativeBrief.requiredResolutionIds,
    mustIncludeEventIds: [], visibleEventIds: [] }));
  const command = { kind: "INTENTS" as const, campaignId: state.metadata.campaignId, expectedStateVersion: 0,
    decisionId: state.currentDecision.id, clientRequestId: `test_request_${suffix}`,
    intents: [{ seat: "BILL" as const, actorId: "test_actor_bill", mode: "ACT" as const,
      declaredAction: "Open the door", desiredOutcome: "Enter safely", approach: "Carefully",
      committedResourceIds: [], targetIds: [], contingency: "Retreat if trapped" }] };
  const engine = createTurnEngine({ campaigns, turns, director, narrator, newTurnId: () => `test_turn_${suffix}` });
  return { temp, state, campaigns, turns, director, narrator, command, engine };
}

describe("invalid Director proposals", () => {
  it("repairs one invalid candidate and commits only the repaired proposal", async () => {
    const fixture = setup("repair_success", true);
    try {
      await expect(fixture.engine.advanceGame(fixture.command)).resolves.toMatchObject({ kind: "COMMITTED" });
      expect(fixture.director.calls).toBe(1);
      expect(fixture.director.repairCalls).toBe(1);
      expect(fixture.narrator.calls).toBe(1);
      expect(fixture.turns.getTurn("test_turn_repair_success").directorProposal?.uncontestedOperations).toEqual([]);
    } finally { fixture.temp.close(); fixture.temp.cleanup(); }
  });

  it("stops after one failed repair without changing committed campaign reality", async () => {
    const fixture = setup("repair_failure", false);
    try {
      await expect(fixture.engine.advanceGame(fixture.command)).rejects.toThrow("DIRECTOR_REPAIR_FAILED");
      expect(fixture.director.calls).toBe(1);
      expect(fixture.director.repairCalls).toBe(1);
      expect(fixture.narrator.calls).toBe(0);
      const campaign = fixture.campaigns.getCampaign(fixture.state.metadata.campaignId);
      expect(campaign.stateVersion).toBe(0);
      expect(campaign.currentState).toEqual(fixture.state);
      const failed = fixture.turns.getTurn("test_turn_repair_failure");
      expect(failed).toMatchObject({ status: "FAILED", directorProposal: null, candidateState: null, narration: null });
      expect(failed.failure?.details).toMatchObject({
        stage: "CANDIDATE_VALIDATION",
        initialIssues: [{ path: "/", message: "UNKNOWN_LOCATION" }],
        repairIssues: [{ path: "/", message: "UNKNOWN_LOCATION" }],
      });
      expect(JSON.stringify(failed.failure)).not.toContain("test_missing_location");
    } finally { fixture.temp.close(); fixture.temp.cleanup(); }
  });
});
