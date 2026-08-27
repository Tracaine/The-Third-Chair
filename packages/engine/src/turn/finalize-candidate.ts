import { DecisionRequestSchema, WorldStateSchema, type DecisionRequest, type WorldState } from "@third-chair/contracts";

export function finalizeCandidateForCommit(input: { previous: WorldState; candidate: WorldState; proposedNextDecision: DecisionRequest; nextRngCounter: number }): { candidate: WorldState; nextDecision: DecisionRequest } {
  const version = input.previous.metadata.stateVersion + 1;
  const nextDecision = DecisionRequestSchema.parse({ ...input.proposedNextDecision, stateVersion: version });
  const candidate = WorldStateSchema.parse({
    ...structuredClone(input.candidate),
    metadata: { ...input.candidate.metadata, campaignId: input.previous.metadata.campaignId, stateVersion: version, turnNumber: input.previous.metadata.turnNumber + 1, rngCounter: input.nextRngCounter },
    currentDecision: nextDecision,
  });
  return { candidate, nextDecision };
}
