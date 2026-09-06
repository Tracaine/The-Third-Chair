import { z } from "zod";
import { ActorIntentSchema } from "./intents.js";
import { DecisionModeSchema } from "./decisions.js";
import { DecisionOwnerSchema, PersistedIdSchema, PlayerSeatSchema } from "./ids.js";
import { CheckResolutionSchema } from "./resolutions.js";
import { SourceCitationSchema, SourceResultSchema } from "./sources.js";
import { PlayerDecisionViewSchema, PlayerViewSchema } from "./views.js";

const VisibleTextSchema = z.string().trim().max(2_000);
const PlayerViewIdSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const AdvanceGameNarrationSchema = z.object({
  sceneText: z.string().trim().min(1).max(8_000),
  spokenNpcLines: z.array(z.string().trim().max(2_000)),
  mustIncludeResolutionIds: z.array(z.string()),
  mustIncludeEventIds: z.array(z.string()),
  visibleEventIds: z.array(z.string()),
}).strict();

export const ListCampaignsInputSchema = z.object({ audience: PlayerSeatSchema }).strict();
export const CampaignSummarySchema = z.object({
  id: PersistedIdSchema,
  name: z.string().trim().min(1).max(200),
  worldDate: PlayerViewSchema.shape.worldDate,
  location: PlayerViewSchema.shape.location,
  stateVersion: z.number().int().nonnegative(),
  decisionOwner: DecisionOwnerSchema,
  decisionMode: DecisionModeSchema,
  status: z.enum(["ACTIVE", "READ_ONLY", "ARCHIVED"]),
  lastCommittedAt: z.string().datetime(),
}).strict();
export const ListCampaignsOutputSchema = z.object({ campaigns: z.array(CampaignSummarySchema) }).strict();

export const GetTableViewInputSchema = z.object({
  campaignId: PersistedIdSchema,
  audience: PlayerSeatSchema,
}).strict();
export const GetTableViewOutputSchema = z.object({
  playerViewId: PlayerViewIdSchema,
  view: PlayerViewSchema,
}).strict();

export const AnswerRulesInputSchema = z.object({
  campaignId: PersistedIdSchema.optional(),
  question: VisibleTextSchema.min(1),
  actorId: PersistedIdSchema.optional(),
}).strict();
export const HouseRuleOverlaySchema = z.object({
  id: PersistedIdSchema,
  title: VisibleTextSchema,
  text: VisibleTextSchema,
  acceptedAtTurn: z.number().int().nonnegative(),
}).strict();
export const AnswerRulesOutputSchema = z.object({
  ruling: VisibleTextSchema,
  citations: z.array(SourceCitationSchema).max(6),
  houseRules: z.array(HouseRuleOverlaySchema).max(50),
}).strict();

export const RecallKnownLoreInputSchema = z.object({
  campaignId: PersistedIdSchema,
  actorId: PersistedIdSchema,
  question: VisibleTextSchema.min(1),
}).strict();
export const RecallKnownLoreOutputSchema = z.object({
  actorId: PersistedIdSchema,
  results: z.array(SourceResultSchema).max(8),
}).strict();

export const AdvanceGameOutputSchema = z.object({
  kind: z.enum(["COMMITTED", "ACTIVE_SUCCESSOR", "AWAITING_INPUT", "RECOVERY_REJECTED"]),
  lockedIntents: z.array(ActorIntentSchema),
  visibleRolls: z.array(CheckResolutionSchema),
  narration: AdvanceGameNarrationSchema.nullable(),
  currentStatus: z.object({ stateVersion: z.number().int().nonnegative() }).strict(),
  nextDecision: PlayerDecisionViewSchema,
  view: PlayerViewSchema,
}).strict();

export const RenderTableInputSchema = z.object({
  campaignId: PersistedIdSchema,
  audience: PlayerSeatSchema,
  playerViewId: PlayerViewIdSchema,
}).strict();
export const VisibleCheckSchema = CheckResolutionSchema.extend({
  consequence: VisibleTextSchema.optional(),
}).strict();
export const TableViewPayloadSchema = z.object({
  playerViewId: PlayerViewIdSchema,
  audience: PlayerSeatSchema,
  playerView: PlayerViewSchema,
  visibleChecks: z.array(VisibleCheckSchema).max(6),
  lastMutationId: PersistedIdSchema.optional(),
  serverStatus: z.enum(["READY", "RECONNECTING"]),
}).strict();

export type ListCampaignsInput = z.infer<typeof ListCampaignsInputSchema>;
export type GetTableViewInput = z.infer<typeof GetTableViewInputSchema>;
export type AnswerRulesInput = z.infer<typeof AnswerRulesInputSchema>;
export type RecallKnownLoreInput = z.infer<typeof RecallKnownLoreInputSchema>;
export type RenderTableInput = z.infer<typeof RenderTableInputSchema>;
export type TableViewPayload = z.infer<typeof TableViewPayloadSchema>;
