import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import cases from "./fixtures/retrieval-cases.json" with { type: "json" };
import { parseRetrievalCases, runRetrievalFixtures } from "../src/retrieval/fixtures.js";
import { createRetrievalFixture } from "./retrieval-fixture.js";

describe("redacted retrieval fixtures", () => {
  test("passes all eleven representative rule, lore, and timeline cases", () => {
    const { db, service } = createRetrievalFixture();
    try {
      const results = runRetrievalFixtures(service, parseRetrievalCases(cases));
      expect(results).toHaveLength(11);
      expect(results.every((item) => item.status === "PASS")).toBe(true);
    } finally { db.close(); }
  });

  test("returns only fixture IDs, status, and stable failure codes", () => {
    const { db, service } = createRetrievalFixture();
    try {
      const results = runRetrievalFixtures(service, parseRetrievalCases(cases));
      expect(Object.keys(results[0]!).sort()).toEqual(["id", "status"]);
      expect(JSON.stringify(results)).not.toMatch(/source-data|rule passage|lore passage/i);
    } finally { db.close(); }
  });

  test("fails a fixture when edition or page provenance is wrong", () => {
    const { db, service } = createRetrievalFixture();
    try {
      const result = runRetrievalFixtures(service, parseRetrievalCases([{ id: "wrong", kind: "RULE", query: "advantage", edition: "FORGOTTEN_REALMS" }]));
      expect(result).toEqual([{ id: "wrong", status: "FAIL", code: "FIXTURE_EDITION_MISMATCH" }]);
    } finally { db.close(); }
  });

  test("fixture catalog contains no expected copyrighted wording", async () => {
    const raw = await readFile(new URL("./fixtures/retrieval-cases.json", import.meta.url), "utf8");
    expect(raw).not.toMatch(/expectedText|passage|answer/i);
  });
});
