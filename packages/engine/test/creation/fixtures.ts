import { readFileSync } from "node:fs";
import type { CharacterDraft } from "@third-chair/contracts";
import type { CharacterCatalog } from "../../src/creation/catalog.js";

export const catalog = JSON.parse(readFileSync(new URL("../fixtures/character-catalog.json", import.meta.url), "utf8")) as CharacterCatalog;

export const billDraft: CharacterDraft = {
  actorId: "test_actor_bill",
  controller: "BILL",
  name: "Alden",
  pronouns: "he/him",
  ancestryKey: "steadfast",
  classKey: "guardian",
  backgroundKey: "envoy",
  abilityMethod: "STANDARD_ARRAY",
  abilities: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 },
  skillKeys: ["athletics", "perception"],
  equipmentChoiceKeys: ["guardian-chain", "guardian-sword"],
  spellKeys: [],
  characterHook: "Keeps promises even when they become inconvenient.",
};

export const ravenDraft: CharacterDraft = {
  actorId: "test_actor_raven",
  controller: "RAVEN",
  name: "Vesper",
  pronouns: "she/her",
  ancestryKey: "starling",
  classKey: "arcanist",
  backgroundKey: "scholar",
  abilityMethod: "STANDARD_ARRAY",
  abilities: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 },
  skillKeys: ["arcana", "investigation"],
  equipmentChoiceKeys: ["arcanist-crystal", "arcanist-wanderer-pack"],
  spellKeys: ["ember", "ward", "whisper"],
  characterHook: "Collects dangerous questions and prettier knives.",
};
