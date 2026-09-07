import {
  CharacterDraftSchema,
  type CharacterDraft,
  type PlayerSeat,
  type QuickstartCharacterChoice,
} from "@third-chair/contracts";
import type { CharacterCatalog } from "./catalog.js";

const source = (name: string) => `third-chair-starter:${name}`;

const skills: CharacterCatalog["skills"] = Object.fromEntries([
  ["acrobatics", "Acrobatics", "dexterity"], ["arcana", "Arcana", "intelligence"],
  ["athletics", "Athletics", "strength"], ["deception", "Deception", "charisma"],
  ["history", "History", "intelligence"], ["insight", "Insight", "wisdom"],
  ["investigation", "Investigation", "intelligence"], ["intimidation", "Intimidation", "charisma"],
  ["medicine", "Medicine", "wisdom"], ["perception", "Perception", "wisdom"],
  ["religion", "Religion", "intelligence"], ["sleight-of-hand", "Sleight of Hand", "dexterity"],
  ["stealth", "Stealth", "dexterity"], ["survival", "Survival", "wisdom"],
].map(([key, displayName, ability]) => [key, { key, displayName, ability, sourceReferenceId: source(`skill:${key}`) }])) as CharacterCatalog["skills"];

const equipment = Object.fromEntries([
  ["test_item_chain_shield", "Chain mail and shield", { base: 18, ability: null }],
  ["test_item_longsword", "Longsword", undefined],
  ["test_item_explorer_pack", "Explorer's pack", undefined],
  ["test_item_leather", "Leather armor", { base: 11, ability: "dexterity" }],
  ["test_item_rapier", "Rapier", undefined],
  ["test_item_shortbow", "Shortbow and 20 arrows", undefined],
  ["test_item_burglar_pack", "Burglar's pack", undefined],
  ["test_item_quarterstaff", "Quarterstaff", undefined],
  ["test_item_components", "Spellbook and component pouch", undefined],
  ["test_item_scholar_pack", "Scholar's pack", undefined],
  ["test_item_scale_shield", "Scale mail and shield", { base: 16, ability: null }],
  ["test_item_mace", "Mace", undefined],
  ["test_item_holy_symbol", "Holy symbol", undefined],
  ["test_item_priest_pack", "Priest's pack", undefined],
].map(([id, displayName, armorClass]) => [id, {
  id, displayName, sourceReferenceId: source(`equipment:${id}`), ...(armorClass ? { armorClass } : {}),
}])) as CharacterCatalog["equipment"];

const catalog: CharacterCatalog = {
  skills,
  ancestries: {
    human: { key: "human", displayName: "Human", sourceReferenceId: source("ancestry:human"), abilityBonuses: {}, speed: 30, featureSourceReferenceIds: [source("feature:human-versatility")] },
    halfling: { key: "halfling", displayName: "Lightfoot Halfling", sourceReferenceId: source("ancestry:halfling"), abilityBonuses: { dexterity: 2 }, speed: 25, featureSourceReferenceIds: [source("feature:halfling-luck")] },
    "high-elf": { key: "high-elf", displayName: "High Elf", sourceReferenceId: source("ancestry:high-elf"), abilityBonuses: { dexterity: 2 }, speed: 30, featureSourceReferenceIds: [source("feature:darkvision")] },
    "hill-dwarf": { key: "hill-dwarf", displayName: "Hill Dwarf", sourceReferenceId: source("ancestry:hill-dwarf"), abilityBonuses: { constitution: 2, wisdom: 1 }, speed: 25, featureSourceReferenceIds: [source("feature:dwarven-resilience")] },
  },
  classes: {
    fighter: { key: "fighter", displayName: "Fighter", sourceReferenceId: source("class:fighter"), hitDie: 10, savingThrowAbilities: ["strength", "constitution"], skillChoice: { count: 2, options: ["athletics", "intimidation", "perception", "survival"] }, fixedEquipmentIds: ["test_item_chain_shield", "test_item_explorer_pack"], equipmentChoiceGroups: [{ key: "weapon", count: 1, choices: [{ key: "sword", equipmentIds: ["test_item_longsword"] }] }], unarmoredArmorClass: { base: 10, ability: "dexterity" }, resources: [{ id: "test_resource_second_wind", name: "Second Wind", maximum: 1, sourceReferenceId: source("feature:second-wind") }], spellcasting: null, featureSourceReferenceIds: [source("feature:fighting-style"), source("feature:second-wind")] },
    rogue: { key: "rogue", displayName: "Rogue", sourceReferenceId: source("class:rogue"), hitDie: 8, savingThrowAbilities: ["dexterity", "intelligence"], skillChoice: { count: 4, options: ["acrobatics", "deception", "investigation", "perception", "sleight-of-hand", "stealth"] }, fixedEquipmentIds: ["test_item_leather", "test_item_burglar_pack"], equipmentChoiceGroups: [{ key: "weapons", count: 1, choices: [{ key: "rapier-bow", equipmentIds: ["test_item_rapier", "test_item_shortbow"] }] }], unarmoredArmorClass: { base: 10, ability: "dexterity" }, resources: [], spellcasting: null, featureSourceReferenceIds: [source("feature:sneak-attack"), source("feature:expertise")] },
    wizard: { key: "wizard", displayName: "Wizard", sourceReferenceId: source("class:wizard"), hitDie: 6, savingThrowAbilities: ["intelligence", "wisdom"], skillChoice: { count: 2, options: ["arcana", "history", "insight", "investigation"] }, fixedEquipmentIds: ["test_item_components", "test_item_scholar_pack"], equipmentChoiceGroups: [{ key: "weapon", count: 1, choices: [{ key: "staff", equipmentIds: ["test_item_quarterstaff"] }] }], unarmoredArmorClass: { base: 10, ability: "dexterity" }, resources: [], spellcasting: { selectionMode: "PREPARED", choiceCount: 3, availableSpellKeys: ["magic-missile", "shield", "sleep"], slots: { "1": 2 } }, featureSourceReferenceIds: [source("feature:arcane-recovery"), source("feature:spellcasting")] },
    cleric: { key: "cleric", displayName: "Cleric", sourceReferenceId: source("class:cleric"), hitDie: 8, savingThrowAbilities: ["wisdom", "charisma"], skillChoice: { count: 2, options: ["history", "insight", "medicine", "religion"] }, fixedEquipmentIds: ["test_item_scale_shield", "test_item_holy_symbol", "test_item_priest_pack"], equipmentChoiceGroups: [{ key: "weapon", count: 1, choices: [{ key: "mace", equipmentIds: ["test_item_mace"] }] }], unarmoredArmorClass: { base: 10, ability: "dexterity" }, resources: [], spellcasting: { selectionMode: "PREPARED", choiceCount: 3, availableSpellKeys: ["cure-wounds", "healing-word", "guiding-bolt"], slots: { "1": 2 } }, featureSourceReferenceIds: [source("feature:divine-domain"), source("feature:spellcasting")] },
  },
  backgrounds: {
    soldier: { key: "soldier", displayName: "Soldier", sourceReferenceId: source("background:soldier"), skillProficiencies: ["athletics", "intimidation"], equipmentIds: [], featureSourceReferenceIds: [source("feature:military-rank")] },
    criminal: { key: "criminal", displayName: "Criminal", sourceReferenceId: source("background:criminal"), skillProficiencies: ["deception", "stealth"], equipmentIds: [], featureSourceReferenceIds: [source("feature:criminal-contact")] },
    sage: { key: "sage", displayName: "Sage", sourceReferenceId: source("background:sage"), skillProficiencies: ["arcana", "history"], equipmentIds: [], featureSourceReferenceIds: [source("feature:researcher")] },
    acolyte: { key: "acolyte", displayName: "Acolyte", sourceReferenceId: source("background:acolyte"), skillProficiencies: ["insight", "religion"], equipmentIds: [], featureSourceReferenceIds: [source("feature:shelter-of-the-faithful")] },
  },
  equipment,
  spells: Object.fromEntries([
    ["magic-missile", "Magic Missile"], ["shield", "Shield"], ["sleep", "Sleep"],
    ["cure-wounds", "Cure Wounds"], ["healing-word", "Healing Word"], ["guiding-bolt", "Guiding Bolt"],
  ].map(([key, displayName]) => [key, { key, displayName, id: `test_spell_${key.replaceAll("-", "_")}`, level: 1, sourceReferenceId: source(`spell:${key}`) }])),
};

const drafts: Record<QuickstartCharacterChoice["archetype"], Omit<CharacterDraft, "actorId" | "controller" | "name" | "pronouns" | "characterHook">> = {
  STALWART_FIGHTER: { ancestryKey: "human", classKey: "fighter", backgroundKey: "soldier", abilityMethod: "STANDARD_ARRAY", abilities: { strength: 15, dexterity: 12, constitution: 14, intelligence: 8, wisdom: 13, charisma: 10 }, skillKeys: ["perception", "survival"], equipmentChoiceKeys: ["sword"], spellKeys: [] },
  CUNNING_ROGUE: { ancestryKey: "halfling", classKey: "rogue", backgroundKey: "criminal", abilityMethod: "STANDARD_ARRAY", abilities: { strength: 8, dexterity: 15, constitution: 13, intelligence: 14, wisdom: 12, charisma: 10 }, skillKeys: ["acrobatics", "investigation", "perception", "sleight-of-hand"], equipmentChoiceKeys: ["rapier-bow"], spellKeys: [] },
  ARCANE_SCHOLAR: { ancestryKey: "high-elf", classKey: "wizard", backgroundKey: "sage", abilityMethod: "STANDARD_ARRAY", abilities: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 }, skillKeys: ["insight", "investigation"], equipmentChoiceKeys: ["staff"], spellKeys: ["magic-missile", "shield", "sleep"] },
  DAWN_CLERIC: { ancestryKey: "hill-dwarf", classKey: "cleric", backgroundKey: "acolyte", abilityMethod: "STANDARD_ARRAY", abilities: { strength: 13, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 15, charisma: 12 }, skillKeys: ["history", "medicine"], equipmentChoiceKeys: ["mace"], spellKeys: ["cure-wounds", "healing-word", "guiding-bolt"] },
};

export function createStarterCharacterCatalog(): CharacterCatalog {
  return catalog;
}

export function quickstartCharacterDraft(choice: QuickstartCharacterChoice, seat: PlayerSeat): CharacterDraft {
  return CharacterDraftSchema.parse({
    ...drafts[choice.archetype],
    actorId: seat === "BILL" ? "10000000-0000-4000-8000-000000000001" : "10000000-0000-4000-8000-000000000002",
    controller: seat,
    name: choice.name,
    pronouns: choice.pronouns,
    characterHook: choice.characterHook,
  });
}
