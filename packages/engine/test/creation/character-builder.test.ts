import { describe, expect, it } from "vitest";
import { buildLevelOneCharacter, listCharacterChoices } from "@third-chair/engine";
import { billDraft, catalog, ravenDraft } from "./fixtures.js";

describe("guided character builder", () => {
  it("builds Bill's selected level-one character", () => {
    const build = buildLevelOneCharacter(billDraft, "BILL", catalog);

    expect(build).toMatchObject({
      actorId: "test_actor_bill",
      controller: "BILL",
      level: 1,
      ancestrySourceKey: "steadfast",
      classSourceKey: "guardian",
      backgroundSourceKey: "envoy",
      equipmentIds: ["test_item_chain", "test_item_seal", "test_item_sword"],
      resources: { test_resource_resolve: { current: 1, maximum: 1 } },
      spells: [],
      spellSlots: {},
    });
  });

  it("builds Raven's selected level-one spellcaster without expanding a generic pack", () => {
    const build = buildLevelOneCharacter(ravenDraft, "RAVEN", catalog);

    expect(build).toMatchObject({
      actorId: "test_actor_raven",
      controller: "RAVEN",
      level: 1,
      equipmentIds: ["test_item_crystal", "test_item_notes", "test_item_spellbook", "test_item_wanderer_pack"],
      spells: ["test_spell_ember", "test_spell_ward", "test_spell_whisper"],
      spellSlots: { "1": { current: 2, maximum: 2 } },
    });
    expect(build.equipmentIds).not.toContain("test_item_rope");
  });

  it("lists only structured choice metadata and source-reference IDs", () => {
    expect(listCharacterChoices(catalog).classes).toContainEqual({
      key: "guardian",
      displayName: "Guardian",
      sourceReferenceId: "synthetic:class:guardian",
    });
  });

  it("rejects an unavailable catalog choice", () => {
    expect(() => buildLevelOneCharacter({ ...billDraft, ancestryKey: "missing" }, "BILL", catalog))
      .toThrow("UNKNOWN_CHARACTER_CHOICE");
  });

  it("enforces equipment-group cardinality", () => {
    expect(() => buildLevelOneCharacter({ ...billDraft, equipmentChoiceKeys: ["guardian-chain"] }, "BILL", catalog))
      .toThrow("INVALID_EQUIPMENT_CHOICE_COUNT");
  });

  it("rejects unavailable or incorrectly bounded spells", () => {
    expect(() => buildLevelOneCharacter({ ...ravenDraft, spellKeys: ["ember", "ward", "missing"] }, "RAVEN", catalog))
      .toThrow("UNKNOWN_SPELL_CHOICE");
    expect(() => buildLevelOneCharacter({ ...ravenDraft, spellKeys: ["ember", "ward"] }, "RAVEN", catalog))
      .toThrow("INVALID_SPELL_CHOICE_COUNT");
  });
});
