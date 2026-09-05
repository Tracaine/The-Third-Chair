import { z } from "zod";
import type { CheckResolution, ResolutionPlan } from "@third-chair/contracts";

export interface BudgetViolation {
  field: string;
  actualBytes: number;
  maximumBytes: number;
  issueCount?: number;
}

/** Never retain input text, schema issue paths, provider errors, or unknown keys. */
export class ContextBudgetError extends Error {
  readonly violations: readonly BudgetViolation[];
  constructor(violations: readonly BudgetViolation[]) {
    super(violations.map(({ field, actualBytes, maximumBytes, issueCount }) =>
      `${field}: ${actualBytes} bytes / ${maximumBytes} maximum${issueCount === undefined ? "" : `; ${issueCount} invalid fields`}`).join("; "));
    this.name = "ContextBudgetError";
    this.violations = violations.map((value) => ({ ...value }));
  }
}

export function utf8Bytes(value: unknown): number {
  try { return Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8"); }
  catch { return 0; }
}

/** Return validated, normalized data, including schema defaults. */
export function checked<T>(field: string, schema: z.ZodType<T>, value: unknown, maximumBytes: number): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ContextBudgetError([{
    field, actualBytes: utf8Bytes(value), maximumBytes, issueCount: result.error.issues.length,
  }]);
  return result.data;
}

/** Persisted records have no defaulted fields; validate strictly but retain exact saved text. */
export function exactPersistedSchema<T extends ResolutionPlan | CheckResolution[] | null>(schema: z.ZodType<T>): z.ZodType<T> {
  return z.custom<T>((value) => schema.safeParse(value).success, "Invalid persisted record")
    .transform((value) => structuredClone(value));
}

export function enforceBudgets(fields: readonly { field: string; value: unknown; maximumBytes: number }[]): void {
  const violations = fields.map(({ field, value, maximumBytes }) => ({ field, actualBytes: utf8Bytes(value), maximumBytes }))
    .filter(({ actualBytes, maximumBytes }) => actualBytes > maximumBytes);
  if (violations.length) throw new ContextBudgetError(violations);
}

export const ContextDiagnosticSchema = z.object({
  bytes: z.record(z.string(), z.number().int().nonnegative()),
  dropped: z.object({ turnSummaries: z.number().int().nonnegative(), memories: z.number().int().nonnegative() }).strict(),
}).strict();
export type ContextDiagnostic = z.infer<typeof ContextDiagnosticSchema>;

/** Includes diagnostic overhead, including the decimal width of the total itself. */
export function measureTotal<T extends { diagnostic: ContextDiagnostic }>(value: T, field: string): number {
  value.diagnostic.bytes[field] = 0;
  for (;;) {
    const total = utf8Bytes(value);
    if (value.diagnostic.bytes[field] === total) return total;
    value.diagnostic.bytes[field] = total;
  }
}

export const TurnSummarySchema = z.object({ id: z.string(), turnNumber: z.number().int().nonnegative(), summary: z.string() }).strict();
export const SelectedMemorySchema = z.object({
  id: z.string(), audience: z.enum(["PUBLIC", "PARTY", "BILL", "RAVEN", "DIRECTOR"]), text: z.string(),
  relatedEntityIds: z.array(z.string()), relevance: z.number().finite(),
}).strict();
export type TurnSummary = z.infer<typeof TurnSummarySchema>;
export type SelectedMemory = z.infer<typeof SelectedMemorySchema>;
export function uniqueRecordIds(records: readonly { id: string }[]): boolean {
  return new Set(records.map(({ id }) => id)).size === records.length;
}
export const TurnSummariesSchema = z.array(TurnSummarySchema).refine(uniqueRecordIds, "Duplicate summary IDs");
export const SelectedMemoriesSchema = z.array(SelectedMemorySchema).refine(uniqueRecordIds, "Duplicate memory IDs");
const compareId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export function newestSummaries(summaries: readonly TurnSummary[]): TurnSummary[] {
  return [...summaries].sort((a, b) => a.turnNumber - b.turnNumber || compareId(a, b)).slice(-12);
}
export function rankedMemories(memories: readonly SelectedMemory[]): SelectedMemory[] {
  return [...memories].sort((a, b) => b.relevance - a.relevance || compareId(a, b));
}
