import type { AdvanceGameCommand, CheckResolution, ResolutionPlan, TurnProposal } from "@third-chair/contracts";
import { createCampaignRepository, createTurnRepository } from "@third-chair/storage";
import { createTempDatabase, resolutionPlan, worldState } from "@third-chair/storage/test/fixtures";
import { createTurnEngine, FailureInjector, FakeDirector, FakeNarrator, sha256Json } from "@third-chair/engine";
import { describe, expect, it } from "vitest";

function commandFor(suffix: string): AdvanceGameCommand {
  const state = worldState(suffix);
  return {
    kind: "INTENTS", campaignId: state.metadata.campaignId, expectedStateVersion: 0,
    decisionId: state.currentDecision.id, clientRequestId: `test_request_${suffix}`,
    intents: [{ seat: "BILL", actorId: "test_actor_bill", mode: "ACT", declaredAction: "Open the door",
      desiredOutcome: "Enter safely", approach: "Carefully", committedResourceIds: [], targetIds: [],
      contingency: "Retreat if trapped" }],
  };
}

function proposalFor(inputState: ReturnType<typeof worldState>, resolutions: readonly CheckResolution[]): TurnProposal {
  return {
    uncontestedOperations: [], checkLinkedOperations: [], memoryWrites: [], riskTags: [],
    nextDecision: { ...inputState.currentDecision, id: `test_next_${inputState.metadata.campaignId}`, stateVersion: 999 },
    narrativeBrief: { summary: resolutions.length === 0 ? "The door opens without resistance." : "The attempt is resolved.",
      requiredResolutionIds: resolutions.map((result) => result.id), requiredEventIds: [] },
  };
}

function seed(suffix: string) {
  const temp = createTempDatabase();
  const state = worldState(suffix);
  const campaigns = createCampaignRepository(temp.db);
  campaigns.createCampaign({ id: state.metadata.campaignId, ownerId: "test_owner", name: "Test campaign",
    sourcePackHash: "test-source-pack", rngSeed: new Uint8Array(32).fill(7), currentState: state,
    currentStateHash: sha256Json(state), rootBranchId: `test_branch_${suffix}`, rootBranchLabel: "Main" });
  return { temp, state, campaigns, turns: createTurnRepository(temp.db) };
}

const narrator = () => new FakeNarrator((input) => ({
  sceneText: "The moment resolves.", spokenNpcLines: [],
  mustIncludeResolutionIds: input.proposal.narrativeBrief.requiredResolutionIds,
  mustIncludeEventIds: input.proposal.narrativeBrief.requiredEventIds, visibleEventIds: [],
}));

describe("live Director resolution port", () => {
  it("persists one immutable plan and reuses its exact dice for an identical call", async () => {
    const fixture = seed("immutable_plan");
    try {
      const plan = resolutionPlan("immutable_plan");
      const director = new FakeDirector((input) => {
        const first = input.runtime.lockAndResolveChecks(plan);
        const second = input.runtime.lockAndResolveChecks(structuredClone(plan));
        expect(first.reused).toBe(false);
        expect(second).toEqual({ ...first, reused: true });
        expect(() => input.runtime.lockAndResolveChecks({ ...plan,
          checks: [{ ...plan.checks[0]!, dc: plan.checks[0]!.dc + 1 }] }))
          .toThrow("LOCKED_PLAN_MISMATCH");
        return proposalFor(input.state, second.resolutions);
      });
      const result = await createTurnEngine({ campaigns: fixture.campaigns, turns: fixture.turns,
        director, narrator: narrator(), newTurnId: () => "test_turn_immutable_plan" })
        .advanceGame(commandFor("immutable_plan"));
      expect(result.kind).toBe("COMMITTED");
      const stored = fixture.turns.getTurn("test_turn_immutable_plan");
      expect(stored.resolutions).toHaveLength(1);
      expect(stored.nextRngCounter).toBe(1);
    } finally { fixture.temp.close(); fixture.temp.cleanup(); }
  });

  it.each(["PLANNED", "RESOLVED"] as const)("resumes after %s without rerolling persisted dice", async (stage) => {
    const suffix = `restart_${stage.toLowerCase()}`;
    const fixture = seed(suffix);
    const turnId = `test_turn_${suffix}`;
    const plan = resolutionPlan(suffix);
    const command = commandFor(suffix);
    try {
      const firstDirector = new FakeDirector((input) => {
        input.runtime.lockAndResolveChecks(plan);
        throw new Error("UNREACHABLE_AFTER_INJECTED_FAILURE");
      });
      await expect(createTurnEngine({ campaigns: fixture.campaigns, turns: fixture.turns,
        director: firstDirector, narrator: narrator(), newTurnId: () => turnId,
        failureInjector: new FailureInjector(stage) }).advanceGame(command))
        .rejects.toThrow(`INJECTED_FAILURE:${stage}`);
      const interrupted = fixture.turns.getTurn(turnId);
      expect(interrupted.status).toBe(stage);
      const persistedDice = interrupted.resolutions?.map((result) => [...result.naturalDice]) ?? null;

      const resumedDirector = new FakeDirector((input) => {
        const result = input.runtime.lockAndResolveChecks(structuredClone(plan));
        expect(result.planId).toBe(plan.id);
        expect(result.reused).toBe(stage === "RESOLVED");
        return proposalFor(input.state, result.resolutions);
      });
      const result = await createTurnEngine({ campaigns: fixture.campaigns, turns: fixture.turns,
        director: resumedDirector, narrator: narrator(), newTurnId: () => "test_unused_turn" })
        .advanceGame(command);
      expect(result.kind).toBe("COMMITTED");
      const committed = fixture.turns.getTurn(turnId);
      expect(committed.nextRngCounter).toBe(1);
      if (persistedDice !== null) expect(committed.resolutions?.map((roll) => roll.naturalDice)).toEqual(persistedDice);
    } finally { fixture.temp.close(); fixture.temp.cleanup(); }
  });

  it("commits a no-check turn with empty resolutions and an unchanged RNG counter", async () => {
    const fixture = seed("no_check");
    try {
      const director = new FakeDirector((input) => proposalFor(input.state, []));
      const result = await createTurnEngine({ campaigns: fixture.campaigns, turns: fixture.turns,
        director, narrator: narrator(), newTurnId: () => "test_turn_no_check" })
        .advanceGame(commandFor("no_check"));
      expect(result.kind).toBe("COMMITTED");
      const stored = fixture.turns.getTurn("test_turn_no_check");
      expect(stored.resolutionPlan).toBeNull();
      expect(stored.resolutions).toEqual([]);
      expect(stored.nextRngCounter).toBe(0);
      expect(fixture.campaigns.getCampaign(fixture.state.metadata.campaignId).currentState.metadata.rngCounter).toBe(0);
    } finally { fixture.temp.close(); fixture.temp.cleanup(); }
  });
});
