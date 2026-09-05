import { describe, expect, it } from "vitest";
import { buildLevelOneCharacter } from "@third-chair/engine";
import { billDraft, catalog, ravenDraft } from "./fixtures.js";

describe("level-one derivation", () => {
  it("requires the exact standard-array multiset", () => {
    const duplicate = {
      ...billDraft,
      abilities: { ...billDraft.abilities, charisma: 12 },
    };

    expect(() => buildLevelOneCharacter(duplicate, "BILL", catalog))
      .toThrow("INVALID_STANDARD_ARRAY_ASSIGNMENT");
  });

  it("derives adjusted abilities, proficiency, HP, AC, saves, and skills", () => {
    const bill = buildLevelOneCharacter(billDraft, "BILL", catalog);

    expect(bill.abilities).toEqual({ strength: 16, dexterity: 14, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 });
    expect(bill.proficiencyBonus).toBe(2);
    expect(bill.maxHp).toBe(12);
    expect(bill.armorClass).toBe(16);
    expect(bill.saves).toEqual({ strength: 5, dexterity: 2, constitution: 4, intelligence: -1, wisdom: 1, charisma: 0 });
    expect(bill.skills).toEqual({ athletics: 5, perception: 3, persuasion: 2 });

    const raven = buildLevelOneCharacter(ravenDraft, "RAVEN", catalog);
    expect(raven.maxHp).toBe(7);
    expect(raven.armorClass).toBe(13);
  });
});
