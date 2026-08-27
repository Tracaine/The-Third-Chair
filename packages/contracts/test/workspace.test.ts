import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@third-chair/contracts";

describe("workspace", () => {
  it("loads the contracts workspace through its package export", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
