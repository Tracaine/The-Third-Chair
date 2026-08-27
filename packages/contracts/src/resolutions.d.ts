import { z } from "zod";
export declare const OutcomeTierSchema: z.ZodEnum<{
    CRITICAL_FAILURE: "CRITICAL_FAILURE";
    FAILURE: "FAILURE";
    SUCCESS: "SUCCESS";
    CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
}>;
export declare const AdvantageModeSchema: z.ZodEnum<{
    NORMAL: "NORMAL";
    ADVANTAGE: "ADVANTAGE";
    DISADVANTAGE: "DISADVANTAGE";
}>;
export declare const ResolutionCheckSchema: z.ZodObject<{
    id: z.ZodString;
    actorId: z.ZodString;
    checkKind: z.ZodString;
    key: z.ZodString;
    sides: z.ZodNumber;
    advantage: z.ZodEnum<{
        NORMAL: "NORMAL";
        ADVANTAGE: "ADVANTAGE";
        DISADVANTAGE: "DISADVANTAGE";
    }>;
    advantageReason: z.ZodString;
    modifier: z.ZodNumber;
    dc: z.ZodNumber;
    visibility: z.ZodEnum<{
        PUBLIC: "PUBLIC";
        SECRET: "SECRET";
    }>;
    successStakes: z.ZodString;
    failureStakes: z.ZodString;
    permittedOutcomeTiers: z.ZodArray<z.ZodEnum<{
        CRITICAL_FAILURE: "CRITICAL_FAILURE";
        FAILURE: "FAILURE";
        SUCCESS: "SUCCESS";
        CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
    }>>;
    citations: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const ResolutionPlanSchema: z.ZodObject<{
    id: z.ZodString;
    checks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        actorId: z.ZodString;
        checkKind: z.ZodString;
        key: z.ZodString;
        sides: z.ZodNumber;
        advantage: z.ZodEnum<{
            NORMAL: "NORMAL";
            ADVANTAGE: "ADVANTAGE";
            DISADVANTAGE: "DISADVANTAGE";
        }>;
        advantageReason: z.ZodString;
        modifier: z.ZodNumber;
        dc: z.ZodNumber;
        visibility: z.ZodEnum<{
            PUBLIC: "PUBLIC";
            SECRET: "SECRET";
        }>;
        successStakes: z.ZodString;
        failureStakes: z.ZodString;
        permittedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
        citations: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const CheckResolutionSchema: z.ZodObject<{
    id: z.ZodString;
    planId: z.ZodString;
    actorId: z.ZodString;
    checkKind: z.ZodString;
    key: z.ZodString;
    naturalDice: z.ZodArray<z.ZodNumber>;
    keptDie: z.ZodNumber;
    modifier: z.ZodNumber;
    total: z.ZodNumber;
    target: z.ZodNumber;
    tier: z.ZodEnum<{
        CRITICAL_FAILURE: "CRITICAL_FAILURE";
        FAILURE: "FAILURE";
        SUCCESS: "SUCCESS";
        CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
    }>;
    visibility: z.ZodEnum<{
        PUBLIC: "PUBLIC";
        SECRET: "SECRET";
    }>;
    advantage: z.ZodEnum<{
        NORMAL: "NORMAL";
        ADVANTAGE: "ADVANTAGE";
        DISADVANTAGE: "DISADVANTAGE";
    }>;
    advantageReason: z.ZodString;
    successStakes: z.ZodString;
    failureStakes: z.ZodString;
    citations: z.ZodArray<z.ZodString>;
    startingCounter: z.ZodNumber;
    endingCounter: z.ZodNumber;
}, z.core.$strict>;
export type OutcomeTier = z.infer<typeof OutcomeTierSchema>;
export type ResolutionPlan = z.infer<typeof ResolutionPlanSchema>;
export type ResolutionCheck = z.infer<typeof ResolutionCheckSchema>;
export type CheckResolution = z.infer<typeof CheckResolutionSchema>;
//# sourceMappingURL=resolutions.d.ts.map