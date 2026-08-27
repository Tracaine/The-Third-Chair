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
// CHAIR-003 extends this stable name with the explicit recovery command.
export const AdvanceGameCommandSchema = IntentAdvanceGameCommandSchema;
//# sourceMappingURL=decisions.js.map