import {
  AbilityNameSchema,
  CharacterBuildSchema,
  CharacterDraftSchema,
  type AbilityName,
  type AbilityScores,
  type CharacterBuild,
  type CharacterDraft,
  type PlayerSeat,
} from "@third-chair/contracts";
import type { ArmorClassFormula, CharacterCatalog } from "./catalog.js";

const ABILITIES = AbilityNameSchema.options;
const STANDARD_ARRAY = [8, 10, 12, 13, 14, 15];

function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function unique(values: readonly string[], error: string): string[] {
  const result = [...new Set(values)];
  if (result.length !== values.length) throw new Error(error);
  return result;
}

function armorClass(formula: ArmorClassFormula, abilities: AbilityScores): number {
  if (formula.ability === null) return formula.base;
  const abilityModifier = modifier(abilities[formula.ability]);
  return formula.base + (formula.maximumAbilityModifier === undefined
    ? abilityModifier
    : Math.min(abilityModifier, formula.maximumAbilityModifier));
}

function requireChoice<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("UNKNOWN_CHARACTER_CHOICE");
  return value;
}

export function buildLevelOneCharacter(
  input: CharacterDraft,
  seat: PlayerSeat,
  catalog: CharacterCatalog,
): CharacterBuild {
  const draft = CharacterDraftSchema.parse(input);
  if (draft.controller !== seat) throw new Error("CHARACTER_SEAT_MISMATCH");

  const assigned = ABILITIES.map((ability) => draft.abilities[ability]).sort((a, b) => a - b);
  if (assigned.some((score, index) => score !== STANDARD_ARRAY[index])) {
    throw new Error("INVALID_STANDARD_ARRAY_ASSIGNMENT");
  }

  const ancestry = requireChoice(catalog.ancestries[draft.ancestryKey]);
  const characterClass = requireChoice(catalog.classes[draft.classKey]);
  const background = requireChoice(catalog.backgrounds[draft.backgroundKey]);

  const abilities = Object.fromEntries(ABILITIES.map((ability) => [
    ability,
    draft.abilities[ability] + (ancestry.abilityBonuses[ability] ?? 0),
  ])) as AbilityScores;

  const selectedSkills = unique(draft.skillKeys, "INVALID_SKILL_CHOICE_COUNT");
  if (selectedSkills.length !== characterClass.skillChoice.count) throw new Error("INVALID_SKILL_CHOICE_COUNT");
  if (selectedSkills.some((key) => !characterClass.skillChoice.options.includes(key) || catalog.skills[key] === undefined)) {
    throw new Error("UNKNOWN_SKILL_CHOICE");
  }
  const skillProficiencies = [...new Set([...selectedSkills, ...background.skillProficiencies])].sort();
  if (skillProficiencies.some((key) => catalog.skills[key] === undefined)) throw new Error("UNKNOWN_CHARACTER_CHOICE");

  const selectedEquipmentKeys = unique(draft.equipmentChoiceKeys, "INVALID_EQUIPMENT_CHOICE_COUNT");
  const knownEquipmentChoices = new Set(characterClass.equipmentChoiceGroups.flatMap((group) => group.choices.map((choice) => choice.key)));
  if (selectedEquipmentKeys.some((key) => !knownEquipmentChoices.has(key))) throw new Error("UNKNOWN_EQUIPMENT_CHOICE");

  const chosenEquipmentIds: string[] = [];
  for (const group of characterClass.equipmentChoiceGroups) {
    const selected = group.choices.filter((choice) => selectedEquipmentKeys.includes(choice.key));
    if (selected.length !== group.count) throw new Error("INVALID_EQUIPMENT_CHOICE_COUNT");
    chosenEquipmentIds.push(...selected.flatMap((choice) => choice.equipmentIds));
  }
  const equipmentIds = unique([
    ...characterClass.fixedEquipmentIds,
    ...background.equipmentIds,
    ...chosenEquipmentIds,
  ], "DUPLICATE_EQUIPMENT_ID").sort();
  const equipment = equipmentIds.map((id) => requireChoice(catalog.equipment[id]));

  const spellKeys = unique(draft.spellKeys, "INVALID_SPELL_CHOICE_COUNT");
  const casting = characterClass.spellcasting;
  if (casting === null) {
    if (spellKeys.length !== 0) throw new Error("INVALID_SPELL_CHOICE_COUNT");
  } else {
    if (spellKeys.some((key) => !casting.availableSpellKeys.includes(key) || catalog.spells[key] === undefined)) {
      throw new Error("UNKNOWN_SPELL_CHOICE");
    }
    if (spellKeys.length !== casting.choiceCount) throw new Error("INVALID_SPELL_CHOICE_COUNT");
  }
  const spells = spellKeys.map((key) => requireChoice(catalog.spells[key]).id).sort();

  const proficiencyBonus = 2;
  const saveProficiencies = unique(characterClass.savingThrowAbilities, "INVALID_SAVE_PROFICIENCIES");
  const saves = Object.fromEntries(ABILITIES.map((ability) => [
    ability,
    modifier(abilities[ability]) + (saveProficiencies.includes(ability) ? proficiencyBonus : 0),
  ])) as Record<AbilityName, number>;
  const skills = Object.fromEntries(skillProficiencies.map((key) => {
    const skill = requireChoice(catalog.skills[key]);
    return [key, modifier(abilities[skill.ability]) + proficiencyBonus];
  }));

  const resources = Object.fromEntries([...characterClass.resources]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((resource) => [resource.id, {
      id: resource.id,
      name: resource.name,
      current: resource.maximum,
      maximum: resource.maximum,
    }]));
  const spellSlots = Object.fromEntries(Object.entries(casting?.slots ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([level, maximum]) => [level, { current: maximum, maximum }]));

  const featureSourceReferenceIds = [...new Set([
    ...ancestry.featureSourceReferenceIds,
    ...characterClass.featureSourceReferenceIds,
    ...background.featureSourceReferenceIds,
  ])].sort();
  const sourceReferenceIds = [...new Set([
    ancestry.sourceReferenceId,
    characterClass.sourceReferenceId,
    background.sourceReferenceId,
    ...featureSourceReferenceIds,
    ...skillProficiencies.map((key) => requireChoice(catalog.skills[key]).sourceReferenceId),
    ...equipment.map((item) => item.sourceReferenceId),
    ...spellKeys.map((key) => requireChoice(catalog.spells[key]).sourceReferenceId),
    ...characterClass.resources.map((resource) => resource.sourceReferenceId),
  ])].sort();

  return CharacterBuildSchema.parse({
    actorId: draft.actorId,
    controller: draft.controller,
    name: draft.name,
    pronouns: draft.pronouns,
    characterHook: draft.characterHook,
    level: 1,
    ancestrySourceKey: draft.ancestryKey,
    classSourceKey: draft.classKey,
    backgroundSourceKey: draft.backgroundKey,
    abilities,
    proficiencyBonus,
    maxHp: characterClass.hitDie + modifier(abilities.constitution),
    armorClass: Math.max(
      armorClass(characterClass.unarmoredArmorClass, abilities),
      ...equipment.flatMap((item) => item.armorClass === undefined ? [] : [armorClass(item.armorClass, abilities)]),
    ),
    saves,
    saveProficiencies,
    skills,
    skillProficiencies,
    speed: ancestry.speed,
    equipmentIds,
    resources,
    spells,
    spellSlots,
    featureSourceReferenceIds,
    sourceReferenceIds,
  });
}
