import { z } from "zod";
import { PersistedIdSchema, PlayerSeatSchema } from "./ids.js";
const FreeTextSchema = z.string().trim().max(2_000);
export const ActorIntentSchema = z
    .object({
    seat: PlayerSeatSchema,
    actorId: PersistedIdSchema,
    mode: z.enum(["ACT", "DEFER", "DECLINE_REACTION"]),
    declaredAction: FreeTextSchema.optional(),
    desiredOutcome: FreeTextSchema.optional(),
    approach: FreeTextSchema.optional(),
    committedResourceIds: z.array(PersistedIdSchema).default([]),
    targetIds: z.array(PersistedIdSchema).default([]),
    contingency: FreeTextSchema.optional(),
})
    .strict()
    .superRefine((intent, ctx) => {
    if (intent.mode === "ACT" && !intent.declaredAction) {
        ctx.addIssue({
            code: "custom",
            path: ["declaredAction"],
            message: "ACT intents require a declaredAction",
        });
    }
});
//# sourceMappingURL=intents.js.map