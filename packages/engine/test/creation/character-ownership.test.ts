import { describe, expect, it } from "vitest";
import { buildLevelOneCharacter, validateCharacterOwnership } from "@third-chair/engine";
import { billDraft, catalog, ravenDraft } from "./fixtures.js";

describe("two-seat character ownership", () => {
  it("accepts one independently selected build for each seat", () => {
    const bill = buildLevelOneCharacter(billDraft, "BILL", catalog);
    const raven = buildLevelOneCharacter(ravenDraft, "RAVEN", catalog);

    expect(validateCharacterOwnership({ bill, raven })).toEqual({ status: "READY", bill, raven });
  });

  it("rejects a draft submitted for the wrong seat", () => {
    expect(() => buildLevelOneCharacter({ ...billDraft, controller: "RAVEN" }, "BILL", catalog))
      .toThrow("CHARACTER_SEAT_MISMATCH");
  });

  it("waits for Raven's draft instead of manufacturing one", () => {
    const bill = buildLevelOneCharacter(billDraft, "BILL", catalog);

    expect(validateCharacterOwnership({ bill })).toEqual({ status: "AWAITING_RAVEN_CHARACTER" });
  });
});
