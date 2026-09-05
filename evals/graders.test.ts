import { describe, expect, it } from "vitest";
import { gradeChair003 } from "./graders.js";

describe("CHAIR-003 live graders", () => {
  it("grades the four observable authority paths without inspecting prose", () => {
    expect(gradeChair003("NO_ROLL", { finalKind: "COMMITTED", rollCount: 0, rngCounter: 0 })).toBe(true);
    expect(gradeChair003("ROLL", { finalKind: "COMMITTED", rollCount: 1, rngCounter: 1 })).toBe(true);
    expect(gradeChair003("AWAITING_RECOVERY", { finalKind: "AWAITING_INPUT", rollCount: 1, rngCounter: 0 })).toBe(true);
    expect(gradeChair003("REUSED_ROLL", { finalKind: "COMMITTED", rollCount: 1, rngCounter: 1,
      beforeDice: [[7]], afterDice: [[7]] })).toBe(true);
    expect(gradeChair003("REUSED_ROLL", { finalKind: "COMMITTED", rollCount: 1, rngCounter: 1,
      beforeDice: [[7]], afterDice: [[8]] })).toBe(false);
  });
});
