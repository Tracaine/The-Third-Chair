import { z } from "zod";
import { DecisionRequestSchema } from "./decisions.js";
import { PersistedIdSchema } from "./ids.js";

const LabelSchema = z.string().trim().min(1).max(200);
const PlayerViewIdSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const CheckpointRiskTagSchema = z.enum([
  "DEATH_RISK",
  "IRREVERSIBLE_ALLEGIANCE",
  "PERMANENT_RARE_RESOURCE",
  "MAJOR_BRANCH_CLOSURE",
  "LEVEL_ADVANCEMENT",
]);

export const CheckpointReasonSchema = z.enum([
  "CAMPAIGN_START",
  "NAMED",
  ...CheckpointRiskTagSchema.options,
]);

export const CheckpointSummarySchema = z.object({
  id: PersistedIdSchema,
  label: LabelSchema,
  reason: CheckpointReasonSchema,
  stateVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
}).strict();

export const CreateCheckpointInputSchema = z.object({
  campaignId: PersistedIdSchema,
  requestId: PersistedIdSchema,
  expectedStateVersion: z.number().int().nonnegative(),
  label: LabelSchema,
}).strict();

export const CreateCheckpointOutputSchema = z.object({
  checkpoint: CheckpointSummarySchema,
}).strict();

export const RewindToCheckpointInputSchema = z.object({
  campaignId: PersistedIdSchema,
  checkpointId: PersistedIdSchema,
  requestId: PersistedIdSchema,
  expectedStateVersion: z.number().int().nonnegative(),
  confirmed: z.literal(true),
}).strict();

export const RewindToCheckpointOutputSchema = z.object({
  checkpoint: CheckpointSummarySchema,
  abandonedBranchId: PersistedIdSchema,
  activeBranchId: PersistedIdSchema,
  stateVersion: z.number().int().nonnegative(),
  currentDecision: DecisionRequestSchema,
  playerViewId: PlayerViewIdSchema,
}).strict();

export type CheckpointRiskTag = z.infer<typeof CheckpointRiskTagSchema>;
export type CheckpointReason = z.infer<typeof CheckpointReasonSchema>;
export type CheckpointSummary = z.infer<typeof CheckpointSummarySchema>;
export type CreateCheckpointInput = z.infer<typeof CreateCheckpointInputSchema>;
export type RewindToCheckpointInput = z.infer<typeof RewindToCheckpointInputSchema>;
