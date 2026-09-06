import type { TurnFailure } from "@third-chair/storage";

export interface SafeEvalIssue {
  readonly path: string;
  readonly code: string;
}

export interface SafeDirectorFailureDetails {
  readonly stage: "CANDIDATE_VALIDATION";
  readonly initialIssues: readonly SafeEvalIssue[];
  readonly repairIssues: readonly SafeEvalIssue[];
}

export function selectEvalCases<T extends { readonly name: string }>(
  allCases: readonly T[],
  requestedName: string | undefined,
): readonly T[] {
  if (requestedName === undefined) return allCases;
  const selected = allCases.find(({ name }) => name === requestedName);
  if (selected === undefined) throw new Error("EVAL_CASE_UNKNOWN");
  return [selected];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeIssues(value: unknown): SafeEvalIssue[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((candidate) => {
    const issue = asRecord(candidate);
    const path = issue?.path;
    const code = issue?.message;
    if (typeof path !== "string" || path.length > 500
      || !/^\/(?:[A-Za-z0-9_.~-]+(?:\/[A-Za-z0-9_.~-]+)*)?$/.test(path)
      || typeof code !== "string" || !/^[A-Z][A-Z0-9_]{2,100}$/.test(code)) return [];
    return [{ path, code }];
  });
}

export function safeDirectorFailureDetails(
  failure: TurnFailure | null | undefined,
): SafeDirectorFailureDetails | undefined {
  if (failure?.code !== "DIRECTOR_REPAIR_FAILED") return undefined;
  const details = asRecord(failure.details);
  if (details?.stage !== "CANDIDATE_VALIDATION") return undefined;
  const initialIssues = safeIssues(details.initialIssues);
  const repairIssues = safeIssues(details.repairIssues);
  if (initialIssues.length === 0 && repairIssues.length === 0) return undefined;
  return { stage: "CANDIDATE_VALIDATION", initialIssues, repairIssues };
}
