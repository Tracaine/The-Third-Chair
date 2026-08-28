import { describe, expect, test } from "vitest";

import aliases from "../config/aliases.v1.json" with { type: "json" };
import { expandAliases, indexEntities } from "../src/indexing/entities.js";
import type { SourceChunk } from "../src/indexing/types.js";

const chunk = (text: string): SourceChunk => ({ id: "lore", documentId: "frcs-3e", pageStart: 1, pageEnd: 1,
  headingPath: ["Lore"], edition: "FRCS_3E_LORE_ONLY", contentKind: "LORE", confidenceStatus: "HIGH_CONFIDENCE",
  text, textSha256: "a".repeat(64) });

describe("reviewed Realms entities", () => {
  test("expands an alias to its canonical reviewed identity", () => {
    expect(expandAliases("Zhents", aliases)).toEqual(["Zhentarim", "Zhents"]);
  });

  test("indexes case-folded exact aliases without creating a second entity", () => {
    const result = indexEntities([chunk("The Zhents bargain with the HARPERS.")], aliases);
    expect(result.entities.map((item) => item.canonicalName)).toEqual(["Harpers", "Zhentarim"]);
    expect(result.mentions).toHaveLength(2);
  });

  test("uses longest matches so Moonsea North does not also mention Moonsea", () => {
    const result = indexEntities([chunk("Trouble gathers in Moonsea North.")], aliases);
    expect(result.mentions).toHaveLength(1);
    expect(result.entities.find((item) => item.id === result.mentions[0]!.entityId)?.canonicalName).toBe("Moonsea");
  });

  test("does not invent entities from unknown capitalized phrases", () => {
    const result = indexEntities([chunk("The Sapphire Turnip entered Shadowdale.")], aliases);
    expect(result.entities.map((item) => item.canonicalName)).toEqual(["Shadowdale"]);
  });
});
