import { z } from "zod";

export const PersistedIdSchema = z.string().refine(
  (value) =>
    /^test_[a-z0-9_]+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value),
  "Expected UUID or test fixture ID",
);

export const SeatSchema = z.enum(["BILL", "RAVEN", "DIRECTOR"]);
export const PlayerSeatSchema = z.enum(["BILL", "RAVEN"]);
export const AudienceSchema = z.enum(["PUBLIC", "PARTY", "BILL", "RAVEN", "DIRECTOR"]);
export const DecisionOwnerSchema = z.enum(["BILL", "RAVEN", "BOTH", "DIRECTOR"]);

export type PersistedId = z.infer<typeof PersistedIdSchema>;
export type Seat = z.infer<typeof SeatSchema>;
export type PlayerSeat = z.infer<typeof PlayerSeatSchema>;
export type Audience = z.infer<typeof AudienceSchema>;
export type DecisionOwner = z.infer<typeof DecisionOwnerSchema>;
