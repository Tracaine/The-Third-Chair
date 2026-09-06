import { describe, expect, it } from "vitest";
import type { TurnFailure } from "@third-chair/storage";
import { safeDirectorFailureDetails, selectEvalCases } from "./eval-support.js";

describe("selectEvalCases", () => {
  const fixtures = [{ name: "first" }, { name: "second" }];

  it("keeps the complete gate by default and selects exactly one requested case", () => {
    expect(selectEvalCases(fixtures, undefined)).toEqual(fixtures);
    expect(selectEvalCases(fixtures, "second")).toEqual([{ name: "second" }]);
  });

  it("rejects an unknown case without starting the live gate", () => {
    expect(() => selectEvalCases(fixtures, "missing")).toThrow("EVAL_CASE_UNKNOWN");
  });
});

describe("safeDirectorFailureDetails", () => {
  it("returns only bounded structural issue evidence from a Director repair failure", () => {
    const failure: TurnFailure = {
      code: "DIRECTOR_REPAIR_FAILED",
      message: "not emitted",
      details: {
        stage: "CANDIDATE_VALIDATION",
        turnId: "not emitted",
        initialIssues: [
          { path: "/nextDecision/locationId", message: "UNKNOWN_LOCATION" },
          { path: "unsafe path", message: "SECRET prose" },
        ],
        repairIssues: [{ path: "/", message: "DIRECTOR_DID_NOT_RESOLVE_CHECKS" }],
      },
    };

    expect(safeDirectorFailureDetails(failure)).toEqual({
      stage: "CANDIDATE_VALIDATION",
      initialIssues: [{ path: "/nextDecision/locationId", code: "UNKNOWN_LOCATION" }],
      repairIssues: [{ path: "/", code: "DIRECTOR_DID_NOT_RESOLVE_CHECKS" }],
    });
    expect(JSON.stringify(safeDirectorFailureDetails(failure))).not.toContain("not emitted");
    expect(JSON.stringify(safeDirectorFailureDetails(failure))).not.toContain("SECRET");
  });

  it("returns no detail for unrelated failures", () => {
    expect(safeDirectorFailureDetails({ code: "OTHER", message: "private" })).toBeUndefined();
  });
});
