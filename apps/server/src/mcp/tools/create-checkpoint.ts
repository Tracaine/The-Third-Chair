import {
  CreateCheckpointInputSchema,
  CreateCheckpointOutputSchema,
  type CreateCheckpointInput,
} from "@third-chair/contracts";
import { createCheckpoint as createCheckpointCommand } from "@third-chair/engine";
import type { CheckpointRepository } from "@third-chair/storage";
import { toMcpResult, type ToolResult } from "../result.js";

export const createCheckpointDescriptor = {
  name: "create_checkpoint",
  description: "Use this when Bill asks to name and preserve the current committed campaign state before continuing play.",
  inputSchema: CreateCheckpointInputSchema.shape,
  outputSchema: CreateCheckpointOutputSchema.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
} as const;

export function createCheckpoint(
  deps: { checkpoints: CheckpointRepository; newCheckpointId?: () => string },
  rawInput: CreateCheckpointInput,
): ToolResult {
  const checkpoint = createCheckpointCommand(deps, rawInput);
  const summary = {
    id: checkpoint.id,
    label: checkpoint.label,
    reason: checkpoint.reason,
    stateVersion: checkpoint.stateVersion,
    createdAt: checkpoint.createdAt,
  };
  return toMcpResult(
    CreateCheckpointOutputSchema,
    { checkpoint: summary },
    `Checkpoint “${checkpoint.label}” preserved at state ${checkpoint.stateVersion}.`,
  );
}
