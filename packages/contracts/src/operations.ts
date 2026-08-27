import { z } from "zod";
import { AudienceSchema, PersistedIdSchema } from "./ids.js";
import { OutcomeTierSchema } from "./resolutions.js";

const Text = z.string().trim().min(1).max(2_000);
const Base = z.object({ id: PersistedIdSchema, reason: Text, audience: AudienceSchema });
export const OperationCauseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("UNCONTESTED"), intentActorId: PersistedIdSchema }).strict(),
  z.object({ type: z.literal("RESOLUTION"), resolutionId: PersistedIdSchema, allowedOutcomeTiers: z.array(OutcomeTierSchema).min(1) }).strict(),
  z.object({ type: z.literal("SYSTEM"), systemRule: z.enum(["INITIATIVE", "TIME", "CHECKPOINT", "REWIND"]) }).strict(),
]);
const WithCause = Base.extend({ cause: OperationCauseSchema });
const Id = { actorId: PersistedIdSchema };
export const WorldOperationSchema = z.discriminatedUnion("kind", [
  WithCause.extend({ kind: z.literal("SET_HP"), ...Id, value: z.number().int().min(-1000).max(1000) }).strict(),
  WithCause.extend({ kind: z.literal("SET_TEMP_HP"), ...Id, value: z.number().int().nonnegative().max(1000) }).strict(),
  WithCause.extend({ kind: z.literal("SPEND_RESOURCE"), ...Id, resourceId: PersistedIdSchema, amount: z.number().int().positive().max(1000) }).strict(),
  WithCause.extend({ kind: z.literal("RESTORE_RESOURCE"), ...Id, resourceId: PersistedIdSchema, amount: z.number().int().positive().max(1000) }).strict(),
  WithCause.extend({ kind: z.literal("ADD_CONDITION"), ...Id, condition: Text }).strict(),
  WithCause.extend({ kind: z.literal("REMOVE_CONDITION"), ...Id, condition: Text }).strict(),
  WithCause.extend({ kind: z.literal("MOVE_ACTOR"), ...Id, locationId: PersistedIdSchema }).strict(),
  WithCause.extend({ kind: z.literal("ADD_INVENTORY"), item: z.object({ id: PersistedIdSchema, name: Text, ownerActorId: PersistedIdSchema.nullable(), containerId: PersistedIdSchema.nullable(), quantity: z.number().int().nonnegative(), equippedSlots: z.array(Text), facts: z.array(z.object({ id: PersistedIdSchema, audience: AudienceSchema, kind: Text, text: Text }).strict()) }).strict() }).strict(),
  WithCause.extend({ kind: z.literal("REMOVE_INVENTORY"), itemId: PersistedIdSchema }).strict(),
  WithCause.extend({ kind: z.literal("SET_EQUIPPED"), itemId: PersistedIdSchema, slots: z.array(Text) }).strict(),
  WithCause.extend({ kind: z.literal("SET_COMBAT"), combat: z.unknown().nullable() }).strict(),
  WithCause.extend({ kind: z.literal("ADVANCE_INITIATIVE") }).strict(),
  WithCause.extend({ kind: z.literal("ADD_FACT"), fact: z.object({ id: PersistedIdSchema, audience: AudienceSchema, kind: Text, text: Text }).strict() }).strict(),
  WithCause.extend({ kind: z.literal("ADD_EVENT"), event: z.object({ id: PersistedIdSchema, audience: AudienceSchema, kind: Text, text: Text }).strict(), intentActorId: PersistedIdSchema.optional() }).strict(),
  WithCause.extend({ kind: z.literal("ADVANCE_CLOCK"), clockId: PersistedIdSchema, amount: z.number().int().positive().max(1000) }).strict(),
  WithCause.extend({ kind: z.literal("SET_NPC_ATTITUDE"), npcId: PersistedIdSchema, status: Text }).strict(),
  WithCause.extend({ kind: z.literal("SET_QUEST_STATUS"), questId: PersistedIdSchema, status: Text }).strict(),
  WithCause.extend({ kind: z.literal("SET_FLAG"), flag: z.object({ id: PersistedIdSchema, audience: AudienceSchema, key: Text, text: Text }).strict() }).strict(),
  WithCause.extend({ kind: z.literal("SET_DECISION"), decision: z.unknown() }).strict(),
]);
export type OperationCause = z.infer<typeof OperationCauseSchema>;
export type WorldOperation = z.infer<typeof WorldOperationSchema>;
