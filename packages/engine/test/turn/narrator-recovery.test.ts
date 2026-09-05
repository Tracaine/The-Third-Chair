import type { AdvanceGameCommand, TurnProposal } from "@third-chair/contracts";
import { createCampaignRepository, createTurnRepository } from "@third-chair/storage";
import { createTempDatabase, resolutionPlan, worldState } from "@third-chair/storage/test/fixtures";
import { createTurnEngine, FakeDirector, FakeNarrator, sha256Json } from "@third-chair/engine";
import { describe, expect, it } from "vitest";

function setup(suffix: string) {
  const temp = createTempDatabase();
  const state = worldState(suffix);
  const campaigns = createCampaignRepository(temp.db);
  const turns = createTurnRepository(temp.db);
  campaigns.createCampaign({ id: state.metadata.campaignId, ownerId: "test_owner", name: "Test campaign",
    sourcePackHash: "test-source-pack", rngSeed: new Uint8Array(32).fill(7), currentState: state,
    currentStateHash: sha256Json(state), rootBranchId: `test_branch_${suffix}`, rootBranchLabel: "Main" });
  const plan = resolutionPlan(suffix);
  const director = new FakeDirector((input) => {
    const result = input.runtime.lockAndResolveChecks(plan);
    const proposal: TurnProposal = { uncontestedOperations: [], checkLinkedOperations: [], memoryWrites: [], riskTags: [],
      nextDecision: { ...input.state.currentDecision, id: `test_next_${suffix}`, stateVersion: 999 },
      narrativeBrief: { summary: "The locked attempt resolves.", requiredResolutionIds: result.resolutions.map(({ id }) => id), requiredEventIds: [] } };
    return proposal;
  });
  const narrator = new FakeNarrator(() => { throw new Error("MODEL_NARRATION_FAILED"); });
  const intents: AdvanceGameCommand = { kind: "INTENTS", campaignId: state.metadata.campaignId,
    expectedStateVersion: 0, decisionId: state.currentDecision.id, clientRequestId: `test_request_${suffix}`,
    intents: [{ seat: "BILL", actorId: "test_actor_bill", mode: "ACT", declaredAction: "Open the door",
      desiredOutcome: "Enter safely", approach: "Carefully", committedResourceIds: [], targetIds: [],
      contingency: "Retreat if trapped" }] };
  const engine = createTurnEngine({ campaigns, turns, director, narrator, newTurnId: () => `test_turn_${suffix}`,
    newRecoveryDecisionId: () => `test_recovery_decision_${suffix}`, newRecoveryCommandId: () => `test_recovery_command_${suffix}` });
  return { temp, state, campaigns, turns, director, narrator, intents, engine };
}

describe("Narrator recovery", () => {
  it("persists one Bill decision after two failures, survives restart, and accepts terse rendering without models or rerolls", async () => {
    const fixture = setup("narrator_accept");
    try {
      const awaiting = await fixture.engine.advanceGame(fixture.intents);
      expect(awaiting.kind).toBe("AWAITING_INPUT");
      expect(fixture.narrator.calls).toBe(2);
      expect(fixture.campaigns.getCampaign(fixture.state.metadata.campaignId).stateVersion).toBe(0);
      const interrupted = fixture.turns.getTurn("test_turn_narrator_accept");
      expect(interrupted).toMatchObject({ status: "AWAITING_INPUT",
        nextDecision: { id: "test_recovery_decision_narrator_accept", owner: "BILL", mode: "CLARIFICATION" } });
      const dice = interrupted.resolutions?.map(({ naturalDice }) => [...naturalDice]);

      const unusedDirector = new FakeDirector(() => { throw new Error("DIRECTOR_MUST_NOT_RUN"); });
      const unusedNarrator = new FakeNarrator(() => { throw new Error("NARRATOR_MUST_NOT_RUN"); });
      const restarted = createTurnEngine({ campaigns: fixture.campaigns, turns: fixture.turns,
        director: unusedDirector, narrator: unusedNarrator, newTurnId: () => "test_unused_turn",
        newRecoveryCommandId: () => "test_recovery_command_narrator_accept" });
      await expect(restarted.advanceGame(fixture.intents)).resolves.toMatchObject({ kind: "AWAITING_INPUT" });

      const recovery: AdvanceGameCommand = { kind: "NARRATION_RECOVERY",
        campaignId: fixture.state.metadata.campaignId, expectedStateVersion: 0,
        decisionId: "test_recovery_decision_narrator_accept", clientRequestId: "test_recovery_request_accept",
        turnId: "test_turn_narrator_accept", acceptTerseRendering: true };
      const committed = await restarted.advanceGame(recovery);
      expect(committed.kind).toBe("COMMITTED");
      expect(committed.narration).toMatchObject({ mustIncludeResolutionIds: ["test_check_narrator_accept"] });
      expect(fixture.turns.getTurn("test_turn_narrator_accept").resolutions?.map(({ naturalDice }) => naturalDice)).toEqual(dice);
      expect(unusedDirector.calls).toBe(0);
      expect(unusedNarrator.calls).toBe(0);
      const duplicate = await restarted.advanceGame(recovery);
      expect(duplicate.turn.id).toBe(committed.turn.id);
      expect(fixture.campaigns.getCampaign(fixture.state.metadata.campaignId).stateVersion).toBe(1);
    } finally { fixture.temp.close(); fixture.temp.cleanup(); }
  });

  it("rejects the resolved successor without changing campaign state", async () => {
    const fixture = setup("narrator_reject");
    try {
      await fixture.engine.advanceGame(fixture.intents);
      const recovery: AdvanceGameCommand = { kind: "NARRATION_RECOVERY",
        campaignId: fixture.state.metadata.campaignId, expectedStateVersion: 0,
        decisionId: "test_recovery_decision_narrator_reject", clientRequestId: "test_recovery_request_reject",
        turnId: "test_turn_narrator_reject", acceptTerseRendering: false };
      await expect(fixture.engine.advanceGame(recovery)).resolves.toMatchObject({ kind: "RECOVERY_REJECTED" });
      expect(fixture.turns.getTurn("test_turn_narrator_reject").status).toBe("FAILED");
      expect(fixture.campaigns.getCampaign(fixture.state.metadata.campaignId).currentState).toEqual(fixture.state);
    } finally { fixture.temp.close(); fixture.temp.cleanup(); }
  });
});
