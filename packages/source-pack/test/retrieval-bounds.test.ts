import { describe, expect, test } from "vitest";
import { createRetrievalFixture } from "./retrieval-fixture.js";

describe("retrieval bounds", () => {
  test("clamps counts and total returned source text", () => {
    const { db, service } = createRetrievalFixture();
    try {
      const rules = service.searchRules({ query: "advantage", limit: 999 });
      const lore = service.searchLore({ query: "Zhents", asOfDr: 1375, limit: 999 });
      expect(rules).toHaveLength(6); expect(lore.length).toBeLessThanOrEqual(8);
      expect(rules.reduce((sum, item) => sum + item.passage.length, 0)).toBeLessThanOrEqual(12_000);
    } finally { db.close(); }
  });

  test("uses an inclusive 1375 DR wall and limits timeline results to twenty", () => {
    const { db, service } = createRetrievalFixture();
    try {
      const results = service.searchTimeline({ toDr: 1375, limit: 999 });
      expect(results).toHaveLength(20);
      expect(Math.max(...results.map((item) => item.yearEndDr))).toBeLessThanOrEqual(1375);
    } finally { db.close(); }
  });
});
