import { describe, expect, it } from "vitest";
import type { StructuredCharacterOption } from "@third-chair/contracts";
import { characterCatalogFromSourceOptions } from "@third-chair/engine";
import { catalog } from "./fixtures.js";

describe("structured source-pack character catalog adapter", () => {
  it("builds Task-1 catalog data from option_json records without reading source prose", () => {
    const options: StructuredCharacterOption[] = [];
    let includeSkills = true;
    for (const [optionKey, value] of Object.entries(catalog.ancestries)) {
      const { key: _key, displayName, sourceReferenceId: ruleSectionId, ...payload } = value;
      options.push({ optionKey, optionKind: "ANCESTRY", displayName, ruleSectionId,
        optionJson: { ...payload, ...(includeSkills ? { skills: catalog.skills } : {}) } });
      includeSkills = false;
    }
    for (const [optionKey, value] of Object.entries(catalog.classes)) {
      const { key: _key, displayName, sourceReferenceId: ruleSectionId, ...optionJson } = value;
      options.push({ optionKey, optionKind: "CLASS", displayName, ruleSectionId, optionJson });
    }
    for (const [optionKey, value] of Object.entries(catalog.backgrounds)) {
      const { key: _key, displayName, sourceReferenceId: ruleSectionId, ...optionJson } = value;
      options.push({ optionKey, optionKind: "BACKGROUND", displayName, ruleSectionId, optionJson });
    }
    for (const [optionKey, value] of Object.entries(catalog.equipment)) {
      const { id: _id, displayName, sourceReferenceId: ruleSectionId, ...optionJson } = value;
      options.push({ optionKey, optionKind: "EQUIPMENT", displayName, ruleSectionId, optionJson });
    }
    for (const [optionKey, value] of Object.entries(catalog.spells)) {
      const { key: _key, displayName, sourceReferenceId: ruleSectionId, ...optionJson } = value;
      options.push({ optionKey, optionKind: "SPELL", displayName, ruleSectionId, optionJson });
    }

    const built = characterCatalogFromSourceOptions(options);
    expect(built).toEqual(catalog);
    expect(built.classes.arcanist?.equipmentChoiceGroups[1]?.choices[0]?.equipmentIds)
      .toEqual(["test_item_wanderer_pack"]);
  });
});
