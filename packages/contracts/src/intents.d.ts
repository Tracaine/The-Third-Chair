import { z } from "zod";
export declare const ActorIntentSchema: z.ZodObject<{
    seat: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
    }>;
    actorId: z.ZodString;
    mode: z.ZodEnum<{
        ACT: "ACT";
        DEFER: "DEFER";
        DECLINE_REACTION: "DECLINE_REACTION";
    }>;
    declaredAction: z.ZodOptional<z.ZodString>;
    desiredOutcome: z.ZodOptional<z.ZodString>;
    approach: z.ZodOptional<z.ZodString>;
    committedResourceIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    targetIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    contingency: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type ActorIntent = z.infer<typeof ActorIntentSchema>;
//# sourceMappingURL=intents.d.ts.map