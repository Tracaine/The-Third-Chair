import { describe, expect, it } from "vitest";
import * as engine from "@third-chair/engine";
import { createCheckpointRepository, createCampaignRepository, createTurnRepository } from "@third-chair/storage";
import { billIntent, createTempDatabase, seedCampaign, worldState } from "@third-chair/storage/test/fixtures";

type Policy = {
  evaluate(input: {
    beforeState: ReturnType<typeof worldState>;
    candidateState: ReturnType<typeof worldState>;
    riskTags: readonly string[];
  }): { reason: string; label: string } | null;
};

function policy(): Policy | undefined {
  return (engine as unknown as { CheckpointPolicy?: Policy }).CheckpointPolicy;
}

describe("automatic checkpoint policy", () => {
  it.each([
    "DEATH_RISK",
    "IRREVERSIBLE_ALLEGIANCE",
    "PERMANENT_RARE_RESOURCE",
    "MAJOR_BRANCH_CLOSURE",
    "LEVEL_ADVANCEMENT",
  ])("requires a before-state checkpoint for %s", (riskTag) => {
    const beforeState = worldState(`policy_${riskTag.toLowerCase()}`);
    const candidateState = structuredClone(beforeState);
    const checkpointPolicy = policy();
    expect(checkpointPolicy).toBeDefined();
    if (!checkpointPolicy) return;

    expect(checkpointPolicy.evaluate({ beforeState, candidateState, riskTags: [riskTag] }))
      .toMatchObject({ reason: riskTag });
  });

  it("detects level advancement from state differences even without a tag", () => {
    const beforeState = worldState("policy_level_diff");
    const candidateState = structuredClone(beforeState);
    candidateState.actors.test_actor_bill!.level = 2;
    const checkpointPolicy = policy();
    expect(checkpointPolicy).toBeDefined();
    if (!checkpointPolicy) return;

    expect(checkpointPolicy.evaluate({ beforeState, candidateState, riskTags: [] }))
      .toMatchObject({ reason: "LEVEL_ADVANCEMENT" });
  });

  it("does not checkpoint an ordinary low-risk turn", () => {
    const beforeState = worldState("policy_ordinary");
    const checkpointPolicy = policy();
    expect(checkpointPolicy).toBeDefined();
    if (!checkpointPolicy) return;

    expect(checkpointPolicy.evaluate({
      beforeState,
      candidateState: structuredClone(beforeState),
      riskTags: [],
    })).toBeNull();
  });

  it("persists the before-state checkpoint inside a risky turn commit", async () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "policy_commit");
      const director = new engine.FakeDirector((input) => ({
        uncontestedOperations: [],
        checkLinkedOperations: [],
        memoryWrites: [],
        riskTags: ["DEATH_RISK"],
        nextDecision: {
          ...input.state.currentDecision,
          id: "test_decision_policy_commit_next",
          stateVersion: 999,
        },
        narrativeBrief: { summary: "Danger approaches.", requiredResolutionIds: [], requiredEventIds: [] },
      }));
      const narrator = new engine.FakeNarrator(() => ({
        sceneText: "The rotten bridge groans beneath Bill's boots.",
        spokenNpcLines: [],
        mustIncludeResolutionIds: [],
        mustIncludeEventIds: [],
        visibleEventIds: [],
      }));
      const turnEngine = engine.createTurnEngine({
        campaigns: createCampaignRepository(temp.db),
        turns: createTurnRepository(temp.db),
        director,
        narrator,
        newTurnId: () => "test_turn_policy_commit",
        newCheckpointId: () => "test_checkpoint_policy_commit",
      } as never);

      await turnEngine.advanceGame({
        kind: "INTENTS",
        campaignId: seeded.campaignId,
        expectedStateVersion: 0,
        decisionId: seeded.state.currentDecision.id,
        clientRequestId: "test_request_policy_commit",
        intents: [billIntent],
      });

      expect(createCheckpointRepository(temp.db).list(seeded.campaignId)).toMatchObject([
        { label: "Campaign Start", stateVersion: 0 },
        { id: "test_checkpoint_policy_commit", reason: "DEATH_RISK", stateVersion: 0, state: seeded.state },
      ]);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});
