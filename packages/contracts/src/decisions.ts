import { z } from "zod";
import { DecisionOwnerSchema, PersistedIdSchema } from "./ids.js";
import { ActorIntentSchema } from "./intents.js";

const VisibleTextSchema = z.string().trim().max(2_000);

export const DecisionModeSchema = z.enum([
  "EXPLORATION",
  "ENCOUNTER",
  "COMBAT",
  "DOWNTIME",
  "REACTION",
  "ADVANCEMENT",
  "CLARIFICATION",
]);

export const DecisionRequestSchema = z.object({
  id: PersistedIdSchema,
  stateVersion: z.number().int().nonnegative(),
  mode: DecisionModeSchema,
  owner: DecisionOwnerSchema,
  eligibleActorIds: z.array(PersistedIdSchema),
  situation: VisibleTextSchema,
  constraints: VisibleTextSchema,
  requiredInput: VisibleTextSchema,
  legalOptions: z.array(VisibleTextSchema).max(12),
}).strict();

export const IntentAdvanceGameCommandSchema = z.object({
  kind: z.literal("INTENTS"),
  campaignId: PersistedIdSchema,
  expectedStateVersion: z.number().int().nonnegative(),
  decisionId: PersistedIdSchema,
  clientRequestId: PersistedIdSchema,
  intents: z.array(ActorIntentSchema),
}).strict();

export const NarrationRecoveryCommandSchema = z.object({
  kind: z.literal("NARRATION_RECOVERY"),
  campaignId: PersistedIdSchema,
  expectedStateVersion: z.number().int().nonnegative(),
  decisionId: PersistedIdSchema,
  clientRequestId: PersistedIdSchema,
  turnId: PersistedIdSchema,
  acceptTerseRendering: z.boolean(),
}).strict();

export const AdvanceGameCommandSchema = z.discriminatedUnion("kind", [
  IntentAdvanceGameCommandSchema,
  NarrationRecoveryCommandSchema,
]);

// MCP SDK tool registration consumes an object shape. The handler still parses
// the discriminated union above, which enforces the fields required by each kind.
export const AdvanceGameMcpInputSchema = z.object({
  kind: z.enum(["INTENTS", "NARRATION_RECOVERY"]),
  campaignId: PersistedIdSchema,
  expectedStateVersion: z.number().int().nonnegative(),
  decisionId: PersistedIdSchema,
  clientRequestId: PersistedIdSchema,
  intents: z.array(ActorIntentSchema).optional(),
  turnId: PersistedIdSchema.optional(),
  acceptTerseRendering: z.boolean().optional(),
}).strict();

export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;
export type IntentAdvanceGameCommand = z.infer<typeof IntentAdvanceGameCommandSchema>;
export type NarrationRecoveryCommand = z.infer<typeof NarrationRecoveryCommandSchema>;
export type AdvanceGameCommand = z.infer<typeof AdvanceGameCommandSchema>;
