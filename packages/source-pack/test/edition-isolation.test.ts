import { describe, expect, test } from "vitest";

import { assertMechanicalAuthority, filterMechanicalAuthority } from "../src/indexing/edition-boundary.js";
import { classifyRulesShapedLore } from "../src/parsing/frcs.js";
import type { SourceChunk } from "../src/indexing/types.js";

const mechanical: SourceChunk = { id: "rule", documentId: "srd-5.1", pageStart: 1, pageEnd: 1,
  headingPath: ["Rules"], edition: "SRD_5_1", contentKind: "MECHANICS", confidenceStatus: "NATIVE_TEXT",
  text: "The rule.", textSha256: "a".repeat(64) };

describe("edition isolation", () => {
  test("requires the complete mechanical authority tuple", () => {
    expect(assertMechanicalAuthority(mechanical)).toBe(true);
    expect(assertMechanicalAuthority({ ...mechanical, documentId: "frcs-3e" })).toBe(false);
    expect(assertMechanicalAuthority({ ...mechanical, edition: "FRCS_3E_LORE_ONLY" })).toBe(false);
    expect(assertMechanicalAuthority({ ...mechanical, contentKind: "LORE" })).toBe(false);
  });

  test("recognizes prestige class, feat, spell statistic, and numeric armor bonus disguises", () => {
    expect(["Prestige Class: Adept", "Feat: Alert", "Spell Level: wizard 3", "Armor Class: +2 armor bonus"]
      .every(classifyRulesShapedLore)).toBe(true);
  });

  test("filters every FRCS disguise while retaining the SRD rule", () => {
    const disguises = ["Prestige Class: Adept", "Feat: Alert", "Spell Level: wizard 3", "Armor Class: +2 armor bonus"]
      .map((text, index): SourceChunk => ({ ...mechanical, id: `lore-${index}`, documentId: "frcs-3e",
        edition: "FRCS_3E_LORE_ONLY", contentKind: "LORE", text }));
    expect(filterMechanicalAuthority([mechanical, ...disguises])).toEqual([mechanical]);
  });
});
