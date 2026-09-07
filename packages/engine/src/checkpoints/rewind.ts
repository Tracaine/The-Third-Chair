import { randomUUID } from "node:crypto";
import {
  DecisionRequestSchema,
  RewindToCheckpointInputSchema,
  type RewindToCheckpointInput,
  type WorldState,
} from "@third-chair/contracts";
import type {
  CampaignRepository,
  CheckpointRepository,
  RewindCheckpointRecord,
} from "@third-chair/storage";
import { sha256Json } from "../hash.js";

export interface RewindDependencies {
  readonly campaigns: CampaignRepository;
  readonly checkpoints: CheckpointRepository;
  readonly newTurnId?: () => string;
  readonly newBranchId?: () => string;
  readonly newDecisionId?: () => string;
}

export function rewindToCheckpoint(
  deps: RewindDependencies,
  rawInput: RewindToCheckpointInput,
): RewindCheckpointRecord {
  const input = RewindToCheckpointInputSchema.parse(rawInput);
  deps.campaigns.getCampaign(input.campaignId);
  const checkpoint = deps.checkpoints.get(input.checkpointId);
  if (checkpoint.campaignId !== input.campaignId) throw new Error("CHECKPOINT_CAMPAIGN_MISMATCH");
  const stateVersion = input.expectedStateVersion + 1;
  const eligibleActorIds = Object.entries(checkpoint.state.actors)
    .filter(([, actor]) => actor.controller === "BILL" || actor.controller === "RAVEN")
    .map(([actorId]) => actorId);
  const nextDecision = DecisionRequestSchema.parse({
    id: (deps.newDecisionId ?? randomUUID)(),
    stateVersion,
    mode: "CLARIFICATION",
    owner: "BOTH",
    eligibleActorIds,
    situation: `The table has rewound to “${checkpoint.label}.”`,
    constraints: "The abandoned future remains preserved in campaign history.",
    requiredInput: "Bill and Raven decide how to proceed from the restored moment.",
    legalOptions: [],
  });
  const restoredState: WorldState = {
    ...structuredClone(checkpoint.state),
    metadata: {
      ...checkpoint.state.metadata,
      stateVersion,
      rngCounter: checkpoint.rngCounter,
    },
    currentDecision: nextDecision,
  };
  return deps.checkpoints.rewind({
    campaignId: input.campaignId,
    checkpointId: input.checkpointId,
    requestId: input.requestId,
    inputHash: sha256Json(input),
    expectedStateVersion: input.expectedStateVersion,
    rewindTurnId: (deps.newTurnId ?? randomUUID)(),
    newBranchId: (deps.newBranchId ?? randomUUID)(),
    restoredState,
    restoredStateHash: sha256Json(restoredState),
    nextDecision,
  });
}
