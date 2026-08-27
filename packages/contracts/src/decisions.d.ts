import { z } from "zod";
export declare const DecisionModeSchema: z.ZodEnum<{
    EXPLORATION: "EXPLORATION";
    ENCOUNTER: "ENCOUNTER";
    COMBAT: "COMBAT";
    DOWNTIME: "DOWNTIME";
    REACTION: "REACTION";
    ADVANCEMENT: "ADVANCEMENT";
    CLARIFICATION: "CLARIFICATION";
}>;
export declare const DecisionRequestSchema: z.ZodObject<{
    id: z.ZodString;
    stateVersion: z.ZodNumber;
    mode: z.ZodEnum<{
        EXPLORATION: "EXPLORATION";
        ENCOUNTER: "ENCOUNTER";
        COMBAT: "COMBAT";
        DOWNTIME: "DOWNTIME";
        REACTION: "REACTION";
        ADVANCEMENT: "ADVANCEMENT";
        CLARIFICATION: "CLARIFICATION";
    }>;
    owner: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        BOTH: "BOTH";
    }>;
    eligibleActorIds: z.ZodArray<z.ZodString>;
    situation: z.ZodString;
    constraints: z.ZodString;
    requiredInput: z.ZodString;
    legalOptions: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const IntentAdvanceGameCommandSchema: z.ZodObject<{
    kind: z.ZodLiteral<"INTENTS">;
    campaignId: z.ZodString;
    expectedStateVersion: z.ZodNumber;
    decisionId: z.ZodString;
    clientRequestId: z.ZodString;
    intents: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const AdvanceGameCommandSchema: z.ZodObject<{
    kind: z.ZodLiteral<"INTENTS">;
    campaignId: z.ZodString;
    expectedStateVersion: z.ZodNumber;
    decisionId: z.ZodString;
    clientRequestId: z.ZodString;
    intents: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>;
}, z.core.$strict>;
export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;
export type IntentAdvanceGameCommand = z.infer<typeof IntentAdvanceGameCommandSchema>;
export type AdvanceGameCommand = z.infer<typeof AdvanceGameCommandSchema>;
//# sourceMappingURL=decisions.d.ts.map