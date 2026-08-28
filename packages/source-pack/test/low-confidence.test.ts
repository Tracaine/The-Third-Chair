import { describe, expect, test } from "vitest";
import { createRetrievalFixture } from "./retrieval-fixture.js";

describe("OCR confidence retrieval", () => {
  test("does not let low-confidence OCR independently support an exact number", () => {
    const { db, service } = createRetrievalFixture();
    try { expect(service.searchLore({ query: "4242", asOfDr: 1375 })).toEqual([]); }
    finally { db.close(); }
  });

  test("does not trust a forged REVIEWED status without its immutable review row", () => {
    const { db, service } = createRetrievalFixture();
    try { expect(service.searchLore({ query: "5151", asOfDr: 1375 })).toEqual([]); }
    finally { db.close(); }
  });
});
