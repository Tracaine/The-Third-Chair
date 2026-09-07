import { z } from "zod";
import { PersistedIdSchema } from "./ids.js";

const TextSchema = z.string().trim().max(2_000);
const NameSchema = z.string().trim().min(1).max(200);
const NonnegativeIntSchema = z.number().int().nonnegative();

export const JournalAudienceSchema = z.enum(["BILL", "RAVEN", "PARTY"]);

const JournalFactSchema = z.object({
  id: PersistedIdSchema,
  kind: NameSchema,
  text: TextSchema,
}).strict();

const JournalEntitySchema = z.object({
  id: PersistedIdSchema,
  name: NameSchema,
  status: NameSchema,
  facts: z.array(JournalFactSchema),
}).strict();

export const VisibleTurnSummarySchema = z.object({
  turnId: PersistedIdSchema,
  stateVersion: NonnegativeIntSchema,
  narrationExcerpt: z.string().trim().max(240),
  visibleResolutionIds: z.array(PersistedIdSchema),
}).strict();

export const PlayerJournalSchema = z.object({
  campaignId: PersistedIdSchema,
  stateVersion: NonnegativeIntSchema,
  audience: JournalAudienceSchema,
  worldDate: z.object({ yearDr: z.number().int(), month: z.string(), day: z.number().int().positive() }).strict(),
  location: z.object({ id: PersistedIdSchema, name: NameSchema, status: NameSchema }).strict(),
  currentObjective: JournalEntitySchema.nullable(),
  immediateRisk: TextSchema.nullable(),
  knownNpcs: z.array(JournalEntitySchema),
  knownClues: z.array(JournalFactSchema),
  inventory: z.array(z.object({
    id: PersistedIdSchema,
    name: NameSchema,
    quantity: NonnegativeIntSchema,
    currency: z.boolean(),
  }).strict()),
  actorStatus: z.array(z.object({
    id: PersistedIdSchema,
    name: NameSchema,
    controller: z.enum(["BILL", "RAVEN"]),
    level: z.number().int().positive().max(20),
    experiencePoints: NonnegativeIntSchema,
    currentHp: z.number().int(),
    maxHp: NonnegativeIntSchema,
    temporaryHp: NonnegativeIntSchema,
    conditions: z.array(NameSchema),
    resources: z.array(z.object({ id: PersistedIdSchema, name: NameSchema, current: NonnegativeIntSchema, maximum: NonnegativeIntSchema }).strict()),
  }).strict()),
  openThreads: z.array(JournalEntitySchema),
  acceptedRulings: z.array(z.object({
    id: PersistedIdSchema,
    title: TextSchema,
    text: TextSchema,
    acceptedAtTurn: z.number().int().nonnegative(),
  }).strict()),
  recentTurns: z.array(VisibleTurnSummarySchema).max(20),
}).strict();

export type JournalAudience = z.infer<typeof JournalAudienceSchema>;
export type VisibleTurnSummary = z.infer<typeof VisibleTurnSummarySchema>;
export type PlayerJournal = z.infer<typeof PlayerJournalSchema>;
