import type { SourcePackService } from "@third-chair/contracts";
import { z } from "zod";

export const RetrievalCaseSchema = z.object({ id: z.string(), kind: z.enum(["RULE", "LORE", "TIMELINE"]),
  query: z.string().optional(), toDr: z.number().int().optional(), edition: z.string() });
export type RetrievalCase = z.infer<typeof RetrievalCaseSchema>;
export const parseRetrievalCases = (value: unknown): RetrievalCase[] => z.array(RetrievalCaseSchema).parse(value);
export type RetrievalFixtureResult = { id: string; status: "PASS" } | { id: string; status: "FAIL"; code: string };

export function runRetrievalFixtures(service: SourcePackService, cases: readonly RetrievalCase[]): RetrievalFixtureResult[] {
  return cases.map((fixture): RetrievalFixtureResult => {
    const results = fixture.kind === "RULE"
      ? service.searchRules({ query: fixture.query ?? "" })
      : fixture.kind === "LORE"
        ? service.searchLore({ query: fixture.query ?? "", asOfDr: fixture.toDr ?? 1375 })
        : service.searchTimeline({ ...(fixture.query ? { query: fixture.query } : {}), toDr: fixture.toDr ?? 1375 });
    if (results.length === 0) return { id: fixture.id, status: "FAIL", code: "FIXTURE_NO_RESULTS" };
    const first = results[0]!;
    if (first.kind !== fixture.kind) return { id: fixture.id, status: "FAIL", code: "FIXTURE_KIND_MISMATCH" };
    if (first.citation.edition !== fixture.edition) return { id: fixture.id, status: "FAIL", code: "FIXTURE_EDITION_MISMATCH" };
    if (first.citation.pageStart < 1 || first.citation.pageEnd < first.citation.pageStart || first.citation.headingPath.length === 0) {
      return { id: fixture.id, status: "FAIL", code: "FIXTURE_PROVENANCE_MISSING" };
    }
    return { id: fixture.id, status: "PASS" };
  });
}
