import { describe, expect, test } from "vitest";
import { assertNoForbiddenSentinels, allowedAudiences } from "@third-chair/engine";

describe("projection leak guards", () => {
  test("returns only public, party, and viewer audiences", () => {
    expect([...allowedAudiences("BILL")]).toEqual(["PUBLIC", "PARTY", "BILL"]);
    expect([...allowedAudiences("RAVEN")]).toEqual(["PUBLIC", "PARTY", "RAVEN"]);
  });

  test("finds forbidden sentinels nested in arrays rather than relying on field names", () => {
    expect(() => assertNoForbiddenSentinels(
      { harmlessName: [{ detail: "SENTINEL_DIRECTOR_CLOCK" }] },
      ["SENTINEL_DIRECTOR_CLOCK"],
    )).toThrow("SENTINEL_DIRECTOR_CLOCK");
  });

  test("rejects structural secret field names at every nesting level", () => {
    expect(() => assertNoForbiddenSentinels(
      { public: [{ director: "not a sentinel" }] },
      [],
    )).toThrow("director");
  });
});
