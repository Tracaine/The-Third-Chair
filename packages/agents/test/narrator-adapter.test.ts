import { NarrationSchema } from "@third-chair/engine";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";
import { projectPlayerView } from "@third-chair/engine";
import { describe, expect, it } from "vitest";
import * as agents from "../src/index.js";
import type { AgentRunClient } from "../src/runner.js";

function input() {
  const view = projectPlayerView(minimumWorldState, "RAVEN");
  return {
    beforeVisibleState: view, visibleState: view, lockedIntents: [], persistedPlan: null,
    resolutions: [], visibleOperations: [], visibleEvents: [],
    proposal: { uncontestedOperations: [], checkLinkedOperations: [], memoryWrites: [], riskTags: [],
      nextDecision: minimumWorldState.currentDecision,
      narrativeBrief: { summary: "The quiet moment passes.", requiredResolutionIds: [], requiredEventIds: [] } },
  };
}

describe("Narrator adapter", () => {
  it("runs a separate structured agent with zero tools and only visible model input", async () => {
    const narration = { sceneText: "The quiet moment passes.", spokenNpcLines: [],
      mustIncludeResolutionIds: [], mustIncludeEventIds: [], visibleEventIds: [] };
    const run: AgentRunClient["run"] = async (agent, serialized, options) => {
      expect(agent.name).toBe("Third Chair Narrator");
      expect(agent.model).toBe("gpt-5.6-sol");
      expect(agent.modelSettings).toEqual({ reasoning: { effort: "medium" }, text: { verbosity: "low" } });
      expect(agent.tools).toEqual([]);
      expect(agent.outputType).toBe(NarrationSchema);
      expect(Object.keys(options.context as object)).toEqual(["abortSignal"]);
      expect(agents.NarratorInputSchema.safeParse(JSON.parse(serialized)).success).toBe(true);
      expect(serialized).not.toContain("sourcePack");
      expect(serialized).not.toContain("rngSeed");
      return { finalOutput: narration, usage: { requests: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15 } };
    };
    const adapter = new agents.OpenAiNarratorAdapter({
      config: agents.loadAgentConfig({}), runClient: { run },
    });
    await expect(adapter.narrate(input())).resolves.toEqual(narration);
  });
});
