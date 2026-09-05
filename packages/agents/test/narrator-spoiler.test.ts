import type { CheckResolution, ResolutionPlan } from "@third-chair/contracts";
import { minimumWorldState, billIntent } from "@third-chair/contracts/test/fixtures";
import { projectPlayerView } from "@third-chair/engine";
import { describe, expect, it } from "vitest";
import * as agents from "../src/index.js";
import type { AgentRunClient } from "../src/runner.js";

const plan: ResolutionPlan = { id: "test_plan_narrator", checks: [{
  id: "test_check_narrator", actorId: "test_actor_bill", checkKind: "Ability Check", key: "strength",
  sides: 20, advantage: "NORMAL", advantageReason: "No advantage.", modifier: 2, dc: 10,
  visibility: "PUBLIC", successStakes: "The door opens.", failureStakes: "The door remains shut.",
  permittedOutcomeTiers: ["SUCCESS", "FAILURE", "CRITICAL_SUCCESS", "CRITICAL_FAILURE"], citations: [],
}] };
const resolution: CheckResolution = {
  id: "test_check_narrator", planId: plan.id, actorId: "test_actor_bill", checkKind: "Ability Check",
  key: "strength", naturalDice: [12], keptDie: 12, modifier: 2, total: 14, target: 10,
  tier: "SUCCESS", visibility: "PUBLIC", advantage: "NORMAL", advantageReason: "No advantage.",
  successStakes: "The door opens.", failureStakes: "The door remains shut.", citations: [],
  startingCounter: 0, endingCounter: 1,
};

function input() {
  const view = projectPlayerView(minimumWorldState, "RAVEN");
  return {
    beforeVisibleState: view, visibleState: view, lockedIntents: [billIntent], persistedPlan: plan,
    resolutions: [resolution], visibleOperations: [], visibleEvents: [],
    proposal: { uncontestedOperations: [], checkLinkedOperations: [], memoryWrites: [], riskTags: [],
      nextDecision: minimumWorldState.currentDecision,
      narrativeBrief: { summary: "The door yields.", requiredResolutionIds: [resolution.id], requiredEventIds: [] } },
  };
}

describe("Narrator deterministic guard", () => {
  it("requires the exact visible check block and required structured IDs", async () => {
    const valid = { sceneText: "Check test_check_narrator: d20 [12], kept 12, modifier +2, total 14 vs DC 10 — SUCCESS.\nThe door yields.",
      spokenNpcLines: [], mustIncludeResolutionIds: [resolution.id], mustIncludeEventIds: [], visibleEventIds: [] };
    const run: AgentRunClient["run"] = async () => ({ finalOutput: valid,
      usage: { requests: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15 } });
    const adapter = new agents.OpenAiNarratorAdapter({ config: agents.loadAgentConfig({}), runClient: { run } });
    await expect(adapter.narrate(input())).resolves.toEqual(valid);

    const invalidRun: AgentRunClient["run"] = async () => ({ finalOutput: { ...valid,
      sceneText: "The door yields.", mustIncludeResolutionIds: [] },
      usage: { requests: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15 } });
    await expect(new agents.OpenAiNarratorAdapter({ config: agents.loadAgentConfig({}), runClient: { run: invalidRun } })
      .narrate(input())).rejects.toThrow("NARRATION_VALIDATION_FAILED");
  });

  it("rejects sentinel leakage and invented quoted player lines", async () => {
    const base = { sceneText: "Check test_check_narrator: d20 [12], kept 12, modifier +2, total 14 vs DC 10 — SUCCESS.",
      spokenNpcLines: [], mustIncludeResolutionIds: [resolution.id], mustIncludeEventIds: [], visibleEventIds: [] };
    for (const sceneText of [`${base.sceneText} SENTINEL_HIDDEN_TRUTH`, `${base.sceneText} Bill says “I surrender.”`]) {
      const run: AgentRunClient["run"] = async () => ({ finalOutput: { ...base, sceneText },
        usage: { requests: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15 } });
      const adapter = new agents.OpenAiNarratorAdapter({ config: agents.loadAgentConfig({}), runClient: { run } });
      await expect(adapter.narrate(input())).rejects.toThrow("NARRATION_VALIDATION_FAILED");
    }
  });
});
