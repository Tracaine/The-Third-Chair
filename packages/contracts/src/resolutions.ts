import { z } from "zod";
import { AudienceSchema, PersistedIdSchema } from "./ids.js";

export const OutcomeTierSchema = z.enum(["CRITICAL_FAILURE", "FAILURE", "SUCCESS", "CRITICAL_SUCCESS"]);
export const AdvantageModeSchema = z.enum(["NORMAL", "ADVANTAGE", "DISADVANTAGE"]);
const Text = z.string().trim().min(1).max(2_000);

export const ResolutionCheckSchema = z.object({
  id: PersistedIdSchema,
  actorId: PersistedIdSchema,
  checkKind: Text,
  key: Text,
  sides: z.number().int().min(2).max(1_000),
  advantage: AdvantageModeSchema,
  advantageReason: Text,
  modifier: z.number().int().min(-100).max(100),
  dc: z.number().int().min(-100).max(1_000),
  visibility: z.enum(["PUBLIC", "SECRET"]),
  successStakes: Text,
  failureStakes: Text,
  permittedOutcomeTiers: z.array(OutcomeTierSchema).min(1),
  citations: z.array(Text).max(20),
}).strict();

export const ResolutionPlanSchema = z.object({
  id: PersistedIdSchema,
  checks: z.array(ResolutionCheckSchema).min(1).max(20),
}).strict();

export const CheckResolutionSchema = z.object({
  id: PersistedIdSchema,
  planId: PersistedIdSchema,
  actorId: PersistedIdSchema,
  checkKind: Text,
  key: Text,
  naturalDice: z.array(z.number().int().min(1)).min(1).max(2),
  keptDie: z.number().int().min(1),
  modifier: z.number().int(),
  total: z.number().int(),
  target: z.number().int(),
  tier: OutcomeTierSchema,
  visibility: z.enum(["PUBLIC", "SECRET"]),
  advantage: AdvantageModeSchema,
  advantageReason: Text,
  successStakes: Text,
  failureStakes: Text,
  citations: z.array(Text).max(20),
  startingCounter: z.number().int().nonnegative(),
  endingCounter: z.number().int().nonnegative(),
}).strict();

export type OutcomeTier = z.infer<typeof OutcomeTierSchema>;
export type ResolutionPlan = z.infer<typeof ResolutionPlanSchema>;
export type ResolutionCheck = z.infer<typeof ResolutionCheckSchema>;
export type CheckResolution = z.infer<typeof CheckResolutionSchema>;
