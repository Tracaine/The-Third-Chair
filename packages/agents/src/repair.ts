import { z } from "zod";
import { ActorIntentSchema, OutcomeTierSchema, PersistedIdSchema, type ActorIntent } from "@third-chair/contracts";
import type { DirectorRepairInput } from "@third-chair/engine";

const RepairInputSchema = z.object({
  turnId: PersistedIdSchema,
  lockedPlanId: PersistedIdSchema.nullable(),
  lockedIntents: z.array(ActorIntentSchema).max(2),
  resolutions: z.array(z.object({ id: PersistedIdSchema, tier: OutcomeTierSchema }).strict()).max(20),
  invalidProposal: z.unknown(),
  issues: z.array(z.object({
    path: z.string().startsWith("/").max(500),
    message: z.string().trim().min(1).max(200),
  }).strict()).min(1).max(20),
}).strict();

/** Serialize only repairable output and normalized diagnostics; hidden state remains local. */
export function serializeDirectorRepairInput(
  input: DirectorRepairInput,
  lockedIntents: readonly ActorIntent[],
): string {
  return JSON.stringify(RepairInputSchema.parse({ ...input, lockedIntents }));
}
