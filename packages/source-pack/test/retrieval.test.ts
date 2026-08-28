import { describe, expect, test } from "vitest";
import { createRetrievalFixture } from "./retrieval-fixture.js";

describe("source retrieval", () => {
  test("returns only authoritative rules with complete page citations", () => {
    const { db, service } = createRetrievalFixture();
    try {
      const results = service.searchRules({ query: "advantage" });
      expect(results).toHaveLength(6);
      expect(results.every((item) => item.kind === "RULE" && item.citation.edition === "SRD_5_1" && item.citation.pageStart > 0)).toBe(true);
      expect(results[0]!.citation.headingPath).toEqual(["Advantage"]);
    } finally { db.close(); }
  });

  test("neutralizes raw FTS operators and resolves Zhents to one canonical entity", () => {
    const { db, service } = createRetrievalFixture();
    try {
      expect(() => service.searchLore({ query: "Zhents OR * NEAR", asOfDr: 1375 })).not.toThrow();
      expect(service.getEntity({ nameOrAlias: "Zhents", asOfDr: 1375 })?.canonicalName).toBe("Zhentarim");
    } finally { db.close(); }
  });
});
