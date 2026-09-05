import { z } from "zod";
import { OutcomeTierSchema, PersistedIdSchema } from "@third-chair/contracts";
import type { DirectorRepairInput } from "@third-chair/engine";

const RepairInputSchema = z.object({
  turnId: PersistedIdSchema,
  lockedPlanId: PersistedIdSchema.nullable(),
  resolutions: z.array(z.object({ id: PersistedIdSchema, tier: OutcomeTierSchema }).strict()).max(20),
  invalidProposal: z.unknown(),
  issues: z.array(z.object({
    path: z.string().startsWith("/").max(500),
    message: z.string().trim().min(1).max(200),
  }).strict()).min(1).max(20),
}).strict();

/** Serialize only repairable output and normalized diagnostics; hidden state remains local. */
export function serializeDirectorRepairInput(input: DirectorRepairInput): string {
  return JSON.stringify(RepairInputSchema.parse(input));
}
