import { z } from "zod";
import { DecisionModeSchema } from "./decisions.js";
import { DecisionOwnerSchema, PersistedIdSchema, PlayerSeatSchema } from "./ids.js";

const VisibleTextSchema = z.string().trim().max(2_000);
const BoundedNameSchema = z.string().trim().min(1).max(200);
const NonnegativeIntSchema = z.number().int().nonnegative();

export const PlayerDecisionViewSchema = z.object({
  id: PersistedIdSchema,
  stateVersion: NonnegativeIntSchema,
  mode: DecisionModeSchema,
  owner: DecisionOwnerSchema,
  situation: VisibleTextSchema,
  eligibleActorIds: z.array(PersistedIdSchema).optional(),
  constraints: VisibleTextSchema.optional(),
  requiredInput: VisibleTextSchema.optional(),
  legalOptions: z.array(VisibleTextSchema).max(12).optional(),
}).strict();

export const PlayerActorViewSchema = z.object({
  id: PersistedIdSchema,
  controller: PlayerSeatSchema,
  name: BoundedNameSchema,
  level: z.number().int().positive().max(20),
  abilities: z.object({
    strength: z.number().int(), dexterity: z.number().int(), constitution: z.number().int(),
    intelligence: z.number().int(), wisdom: z.number().int(), charisma: z.number().int(),
  }).strict(),
  proficiencyBonus: z.number().int(),
  armorClass: NonnegativeIntSchema,
  maxHp: NonnegativeIntSchema,
  currentHp: z.number().int(),
  temporaryHp: NonnegativeIntSchema,
  speed: NonnegativeIntSchema,
  conditions: z.array(BoundedNameSchema),
  deathSaves: z.object({ successes: z.number().int().min(0).max(3), failures: z.number().int().min(0).max(3) }).strict(),
  publicNotes: z.array(VisibleTextSchema),
  resources: z.array(z.object({
    id: PersistedIdSchema, name: BoundedNameSchema, current: NonnegativeIntSchema, maximum: NonnegativeIntSchema,
  }).strict()).optional(),
  scopedNotes: z.array(z.object({ id: PersistedIdSchema, text: VisibleTextSchema }).strict()).optional(),
}).strict();

const VisibleFactSchema = z.object({ id: PersistedIdSchema, kind: BoundedNameSchema, text: VisibleTextSchema }).strict();
const VisibleEventSchema = z.object({ id: PersistedIdSchema, kind: BoundedNameSchema, text: VisibleTextSchema }).strict();
const VisibleEntitySchema = z.object({
  id: PersistedIdSchema, name: BoundedNameSchema, status: BoundedNameSchema, facts: z.array(VisibleFactSchema),
}).strict();

export const PlayerViewSchema = z.object({
  campaignId: PersistedIdSchema,
  stateVersion: NonnegativeIntSchema,
  worldDate: z.object({ yearDr: z.number().int(), month: z.string(), day: z.number().int().positive() }).strict(),
  location: VisibleEntitySchema,
  sceneId: PersistedIdSchema,
  actors: z.array(PlayerActorViewSchema),
  inventory: z.array(z.object({
    id: PersistedIdSchema, name: BoundedNameSchema, ownerActorId: PersistedIdSchema.nullable(),
    containerId: PersistedIdSchema.nullable(), quantity: NonnegativeIntSchema, equippedSlots: z.array(BoundedNameSchema), facts: z.array(VisibleFactSchema),
  }).strict()),
  npcs: z.array(VisibleEntitySchema),
  factions: z.array(VisibleEntitySchema),
  facts: z.array(VisibleFactSchema),
  events: z.array(VisibleEventSchema),
  clocks: z.array(z.object({
    id: PersistedIdSchema, name: BoundedNameSchema, status: BoundedNameSchema, current: NonnegativeIntSchema, maximum: z.number().int().positive(), facts: z.array(VisibleFactSchema),
  }).strict()),
  openThreads: z.array(VisibleEntitySchema),
  combat: z.object({
    id: PersistedIdSchema, round: z.number().int().positive(), currentActorId: PersistedIdSchema.nullable(), initiativeOrder: z.array(PersistedIdSchema), facts: z.array(VisibleFactSchema),
  }).strict().nullable(),
  currentDecision: PlayerDecisionViewSchema,
  recoveryStatus: z.literal("NONE"),
}).strict();

export type PlayerDecisionView = z.infer<typeof PlayerDecisionViewSchema>;
export type PlayerActorView = z.infer<typeof PlayerActorViewSchema>;
export type PlayerView = z.infer<typeof PlayerViewSchema>;
