import { describe, expect, test } from "vitest";

import { parseFrcsPages } from "../src/parsing/frcs.js";

describe("FRCS lore-only parsing", () => {
  test("emits only lore-authority chunks with OCR provenance", () => {
    const result = parseFrcsPages([{ page: 116, text: "THE DALELANDS\nShadowdale is one of the Dales.", meanConfidence: 92, status: "HIGH_CONFIDENCE" }]);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]).toMatchObject({ documentId: "frcs-3e", pageStart: 116, pageEnd: 116, edition: "FRCS_3E_LORE_ONLY", contentKind: "LORE" });
  });

  test("diagnoses and excludes four rules-shaped disguises", () => {
    const text = [
      "ORGANIZATIONS", "The Zhentarim operate widely.",
      "Prestige Class: Shadow Adept", "Feat: Regional Training",
      "Spell Level: wizard 3", "Armor Class: +2 armor bonus",
    ].join("\n\n");
    const result = parseFrcsPages([{ page: 250, text, meanConfidence: 91, status: "HIGH_CONFIDENCE" }]);
    expect(result.diagnostics.filter((item) => item.containsEditionMechanics)).toHaveLength(4);
    expect(result.chunks.map((item) => item.text).join(" ")).toContain("Zhentarim");
    expect(result.chunks.map((item) => item.text).join(" ")).not.toMatch(/Prestige Class|Feat:|Spell Level|armor bonus/i);
  });

  test("gives repeated OCR paragraphs distinct deterministic chunk identities", () => {
    const result = parseFrcsPages([{ page: 250, text: "ORGANIZATIONS\n\nA repeated footer.\n\nA repeated footer.", meanConfidence: 91, status: "HIGH_CONFIDENCE" }]);
    expect(result.chunks).toHaveLength(2);
    expect(new Set(result.chunks.map((item) => item.id)).size).toBe(2);
  });
});
