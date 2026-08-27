import { z } from "zod";
import { DecisionRequestSchema, type DecisionRequest } from "./decisions.js";
import { AudienceSchema, PersistedIdSchema, SeatSchema, type PlayerSeat } from "./ids.js";
import { ActorIntentSchema, type ActorIntent } from "./intents.js";

const BoundedTextSchema = z.string().trim().max(2_000);
const BoundedNameSchema = z.string().trim().min(1).max(200);
const NonnegativeIntSchema = z.number().int().nonnegative();

const ScopedTextSchema = z.object({
  id: PersistedIdSchema,
  audience: AudienceSchema,
  text: BoundedTextSchema,
}).strict();

export const ScopedFactSchema = ScopedTextSchema.extend({ kind: BoundedNameSchema }).strict();
export const ScopedEventSchema = ScopedTextSchema.extend({ kind: BoundedNameSchema }).strict();
export const ScopedFlagSchema = ScopedTextSchema.extend({ key: BoundedNameSchema }).strict();

export const ResourceStateSchema = z.object({
  id: PersistedIdSchema,
  name: BoundedNameSchema,
  current: NonnegativeIntSchema,
  maximum: NonnegativeIntSchema,
}).strict();

export const ActorStateSchema = z.object({
  controller: SeatSchema,
  name: BoundedNameSchema,
  level: z.number().int().positive().max(20),
  classSourceKey: BoundedNameSchema,
  ancestrySourceKey: BoundedNameSchema,
  backgroundSourceKey: BoundedNameSchema,
  abilities: z.object({
    strength: z.number().int(),
    dexterity: z.number().int(),
    constitution: z.number().int(),
    intelligence: z.number().int(),
    wisdom: z.number().int(),
    charisma: z.number().int(),
  }).strict(),
  proficiencyBonus: z.number().int(),
  armorClass: NonnegativeIntSchema,
  maxHp: NonnegativeIntSchema,
  currentHp: z.number().int(),
  temporaryHp: NonnegativeIntSchema,
  speed: NonnegativeIntSchema,
  conditions: z.array(BoundedNameSchema),
  deathSaves: z.object({ successes: z.number().int().min(0).max(3), failures: z.number().int().min(0).max(3) }).strict(),
  resources: z.record(PersistedIdSchema, ResourceStateSchema),
  spells: z.array(PersistedIdSchema),
  equipmentIds: z.array(PersistedIdSchema),
  publicNotes: z.array(BoundedTextSchema),
  scopedNotes: z.array(ScopedTextSchema),
}).strict();

export const InventoryItemSchema = z.object({
  id: PersistedIdSchema,
  name: BoundedNameSchema,
  ownerActorId: PersistedIdSchema.nullable(),
  containerId: PersistedIdSchema.nullable(),
  quantity: NonnegativeIntSchema,
  equippedSlots: z.array(BoundedNameSchema),
  facts: z.array(ScopedFactSchema),
}).strict();

export const CombatStateSchema = z.object({
  id: PersistedIdSchema,
  round: z.number().int().positive(),
  currentActorId: PersistedIdSchema,
  initiativeOrder: z.array(PersistedIdSchema),
  facts: z.array(ScopedFactSchema),
}).strict();

export const LocationStateSchema = z.object({
  id: PersistedIdSchema,
  audience: AudienceSchema,
  name: BoundedNameSchema,
  status: BoundedNameSchema,
  facts: z.array(ScopedFactSchema),
}).strict();
export const NpcStateSchema = z.object({
  id: PersistedIdSchema,
  audience: AudienceSchema,
  name: BoundedNameSchema,
  status: BoundedNameSchema,
  facts: z.array(ScopedFactSchema),
}).strict();
export const FactionStateSchema = z.object({
  id: PersistedIdSchema,
  audience: AudienceSchema,
  name: BoundedNameSchema,
  status: BoundedNameSchema,
  facts: z.array(ScopedFactSchema),
}).strict();
export const QuestStateSchema = z.object({
  id: PersistedIdSchema,
  audience: AudienceSchema,
  name: BoundedNameSchema,
  status: BoundedNameSchema,
  facts: z.array(ScopedFactSchema),
}).strict();
export const ClockStateSchema = z.object({
  id: PersistedIdSchema,
  audience: AudienceSchema,
  name: BoundedNameSchema,
  status: BoundedNameSchema,
  current: NonnegativeIntSchema,
  maximum: z.number().int().positive(),
  facts: z.array(ScopedFactSchema),
}).strict();

export const WorldStateSchema = z.object({
  metadata: z.object({
    schemaVersion: z.literal(1),
    campaignId: PersistedIdSchema,
    turnNumber: NonnegativeIntSchema,
    stateVersion: NonnegativeIntSchema,
    worldDate: z.object({ yearDr: z.number().int(), month: z.string(), day: z.number().int().positive() }).strict(),
    currentLocationId: PersistedIdSchema,
    sceneId: PersistedIdSchema,
    rngCounter: NonnegativeIntSchema,
  }).strict(),
  table: z.object({
    rulesEdition: z.literal("SRD_5_1"),
    settingDateDr: z.literal(1375),
    diceMode: z.literal("SERVER_OPEN"),
    deathMode: z.enum(["STANDARD", "HEROIC"]),
    houseRules: z.array(z.object({ id: PersistedIdSchema, title: BoundedTextSchema, text: BoundedTextSchema, acceptedAtTurn: z.number().int() }).strict()),
  }).strict(),
  actors: z.record(PersistedIdSchema, ActorStateSchema),
  inventory: z.record(PersistedIdSchema, InventoryItemSchema),
  combat: CombatStateSchema.nullable(),
  locations: z.record(PersistedIdSchema, LocationStateSchema),
  npcs: z.record(PersistedIdSchema, NpcStateSchema),
  factions: z.record(PersistedIdSchema, FactionStateSchema),
  quests: z.record(PersistedIdSchema, QuestStateSchema),
  facts: z.array(ScopedFactSchema),
  events: z.array(ScopedEventSchema),
  clocks: z.record(PersistedIdSchema, ClockStateSchema),
  flags: z.array(ScopedFlagSchema),
  currentDecision: DecisionRequestSchema,
}).strict();

export type WorldState = z.infer<typeof WorldStateSchema>;

export function requiredSeats(decision: DecisionRequest): Set<PlayerSeat> {
  if (decision.owner === "BILL") return new Set(["BILL"]);
  if (decision.owner === "RAVEN") return new Set(["RAVEN"]);
  if (decision.owner === "BOTH") return new Set(["BILL", "RAVEN"]);
  return new Set();
}

export function validateIntentsForDecision(
  decision: DecisionRequest,
  intents: ActorIntent[],
  currentState: WorldState,
): void {
  const parsedDecision = DecisionRequestSchema.parse(decision);
  const parsedIntents = z.array(ActorIntentSchema).parse(intents);
  const suppliedSeats = new Set<PlayerSeat>();

  for (const intent of parsedIntents) {
    if (suppliedSeats.has(intent.seat)) throw new Error(`Duplicate intent for ${intent.seat}`);
    suppliedSeats.add(intent.seat);
  }

  const required = requiredSeats(parsedDecision);
  const missing = [...required].filter((seat) => !suppliedSeats.has(seat));
  if (missing.length > 0) {
    throw new Error(`Decision requires intents from ${[...required].join(" and ")}`);
  }
  const extra = [...suppliedSeats].filter((seat) => !required.has(seat));
  if (extra.length > 0) throw new Error(`Decision does not accept intents from ${extra.join(" and ")}`);

  for (const intent of parsedIntents) {
    if (!parsedDecision.eligibleActorIds.includes(intent.actorId)) {
      throw new Error(`Actor ${intent.actorId} is not eligible for this decision`);
    }
    const actor = currentState.actors[intent.actorId];
    if (!actor) throw new Error(`Actor ${intent.actorId} does not exist in current state`);
    if (actor.controller !== intent.seat) {
      throw new Error(`Actor ${intent.actorId} is controlled by ${actor.controller}`);
    }
    if (intent.mode === "ACT") {
      for (const resourceId of intent.committedResourceIds) {
        if (!actor.resources[resourceId]) {
          throw new Error(`Actor ${intent.actorId} does not own resource ${resourceId}`);
        }
      }
    }
  }
}
