import { describe, expect, it } from "vitest";
import { createFakeSourcePack } from "@third-chair/server";

describe("local gate source pack", () => {
  it("provides bounded deterministic rules and lore without private source files", () => {
    const sources = createFakeSourcePack();
    expect(sources.manifest()).toEqual({ sourcePackManifestHash: "test_fake_source_pack" });
    expect(sources.searchRules({ query: "cover", limit: 99 })).toEqual([
      expect.objectContaining({ kind: "RULE", id: "test_fake_rule_cover" }),
    ]);
    expect(sources.searchLore({ query: "Raven", entityIds: ["test_demo_raven"], limit: 99 })).toEqual([
      expect.objectContaining({ kind: "LORE", id: "test_fake_lore_raven" }),
    ]);
    expect(sources.searchLore({ query: "secret", entityIds: [], limit: 99 })).toEqual([]);
  });
});
