import { z } from "zod";
export declare const PersistedIdSchema: z.ZodString;
export declare const SeatSchema: z.ZodEnum<{
    BILL: "BILL";
    RAVEN: "RAVEN";
    DIRECTOR: "DIRECTOR";
}>;
export declare const PlayerSeatSchema: z.ZodEnum<{
    BILL: "BILL";
    RAVEN: "RAVEN";
}>;
export declare const AudienceSchema: z.ZodEnum<{
    BILL: "BILL";
    RAVEN: "RAVEN";
    DIRECTOR: "DIRECTOR";
    PUBLIC: "PUBLIC";
    PARTY: "PARTY";
}>;
export declare const DecisionOwnerSchema: z.ZodEnum<{
    BILL: "BILL";
    RAVEN: "RAVEN";
    DIRECTOR: "DIRECTOR";
    BOTH: "BOTH";
}>;
export type PersistedId = z.infer<typeof PersistedIdSchema>;
export type Seat = z.infer<typeof SeatSchema>;
export type PlayerSeat = z.infer<typeof PlayerSeatSchema>;
export type Audience = z.infer<typeof AudienceSchema>;
export type DecisionOwner = z.infer<typeof DecisionOwnerSchema>;
//# sourceMappingURL=ids.d.ts.map