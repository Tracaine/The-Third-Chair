import { randomUUID } from "node:crypto";
import {
  CreateCheckpointInputSchema,
  type CreateCheckpointInput,
} from "@third-chair/contracts";
import type { CheckpointRecord, CheckpointRepository } from "@third-chair/storage";

export function createCheckpoint(
  deps: { readonly checkpoints: CheckpointRepository; readonly newCheckpointId?: () => string },
  rawInput: CreateCheckpointInput,
): CheckpointRecord {
  const input = CreateCheckpointInputSchema.parse(rawInput);
  return deps.checkpoints.createNamed({
    checkpointId: (deps.newCheckpointId ?? randomUUID)(),
    campaignId: input.campaignId,
    requestId: input.requestId,
    expectedStateVersion: input.expectedStateVersion,
    label: input.label,
  });
}
