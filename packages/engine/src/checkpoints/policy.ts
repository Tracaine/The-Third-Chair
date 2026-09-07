import {
  CheckpointRiskTagSchema,
  WorldStateSchema,
  type CheckpointRiskTag,
  type WorldState,
} from "@third-chair/contracts";

const automaticReasons = CheckpointRiskTagSchema.options;

const labels: Record<CheckpointRiskTag, string> = {
  DEATH_RISK: "Before death risk",
  IRREVERSIBLE_ALLEGIANCE: "Before irreversible allegiance",
  PERMANENT_RARE_RESOURCE: "Before permanent rare-resource spend",
  MAJOR_BRANCH_CLOSURE: "Before major branch closure",
  LEVEL_ADVANCEMENT: "Before level advancement",
};

function hasLevelAdvancement(before: WorldState, candidate: WorldState): boolean {
  return Object.entries(candidate.actors).some(([actorId, actor]) => {
    const previous = before.actors[actorId];
    return previous !== undefined && actor.level > previous.level;
  });
}

export const CheckpointPolicy = {
  evaluate(input: {
    beforeState: WorldState;
    candidateState: WorldState;
    riskTags: readonly CheckpointRiskTag[];
  }): { readonly reason: CheckpointRiskTag; readonly label: string } | null {
    const beforeState = WorldStateSchema.parse(input.beforeState);
    const candidateState = WorldStateSchema.parse(input.candidateState);
    const tags = CheckpointRiskTagSchema.array().parse(input.riskTags);
    const reason = automaticReasons.find((tag) => tags.includes(tag))
      ?? (hasLevelAdvancement(beforeState, candidateState) ? "LEVEL_ADVANCEMENT" : undefined);
    if (reason === undefined) return null;
    return {
      reason,
      label: `${labels[reason]} — state ${beforeState.metadata.stateVersion}`,
    };
  },
} as const;
