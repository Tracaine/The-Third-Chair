import { z } from "zod";
export const PersistedIdSchema = z.string().refine((value) => /^test_[a-z0-9_]+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value), "Expected UUID or test fixture ID");
export const SeatSchema = z.enum(["BILL", "RAVEN", "DIRECTOR"]);
export const PlayerSeatSchema = z.enum(["BILL", "RAVEN"]);
export const AudienceSchema = z.enum(["PUBLIC", "PARTY", "BILL", "RAVEN", "DIRECTOR"]);
export const DecisionOwnerSchema = z.enum(["BILL", "RAVEN", "BOTH", "DIRECTOR"]);
//# sourceMappingURL=ids.js.map