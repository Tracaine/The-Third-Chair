import { WorldStateSchema, type SourcePackService, type TurnProposal } from "@third-chair/contracts";
import { billIntent, ravenIntent, minimumWorldStateInput, bothDecision } from "@third-chair/contracts/test/fixtures";

export const sourcePack: SourcePackService = {
  searchRules: () => [], searchLore: () => [], searchTimeline: () => [], getEntity: () => null,
  manifest: () => ({ sourcePackManifestHash: "SENTINEL_SOURCE_HANDLE" }),
};
export function directorInput() {
  return {
    turnId: "test_turn", persistedPlan: null, persistedResolutions: [],
    state: WorldStateSchema.parse(minimumWorldStateInput),
    intents: [structuredClone(billIntent), structuredClone(ravenIntent)],
    runtime: { lockAndResolveChecks: () => ({ resolutions: [], nextRngCounter: 0 }) },
  };
}
export function proposal(): TurnProposal {
  return {
    uncontestedOperations: [], checkLinkedOperations: [], memoryWrites: [], riskTags: [],
    nextDecision: { ...bothDecision, id: "test_next_decision" },
    narrativeBrief: { summary: "The door is open.", requiredResolutionIds: [], requiredEventIds: [] },
  };
}
export const usage = { requests: 1, inputTokens: 20, outputTokens: 10, totalTokens: 30 };
