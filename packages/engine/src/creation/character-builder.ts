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
  return formula.base + (formula.secondAbility ? modifier(abilities[formula.secondAbility]) : 0) + (formula.maximumAbilityModifier === undefined
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

  const flexibleAbilities = unique(draft.ancestryAbilityKeys ?? [], "INVALID_ANCESTRY_ABILITY_CHOICES");
  if (flexibleAbilities.length !== (ancestry.abilityChoices ?? 0) || flexibleAbilities.includes("charisma")) {
    throw new Error("INVALID_ANCESTRY_ABILITY_CHOICES");
  }
  const abilities = Object.fromEntries(ABILITIES.map((ability) => [
    ability,
    draft.abilities[ability] + (ancestry.abilityBonuses[ability] ?? 0) + Number(flexibleAbilities.includes(ability)),
  ])) as AbilityScores;

  const fixedSkills = [...(ancestry.skillProficiencies ?? []), ...background.skillProficiencies];
  const selectedSkills = unique(draft.skillKeys, "INVALID_SKILL_CHOICE_COUNT");
  const duplicateGrants = fixedSkills.length - new Set(fixedSkills).size;
  const freeSkillCount = (ancestry.skillChoices ?? 0) + duplicateGrants;
  if (selectedSkills.length !== characterClass.skillChoice.count + freeSkillCount) throw new Error("INVALID_SKILL_CHOICE_COUNT");
  if (selectedSkills.some((key) => !catalog.skills[key] || fixedSkills.includes(key))
    || selectedSkills.filter((key) => characterClass.skillChoice.options.includes(key)).length < characterClass.skillChoice.count) {
    throw new Error("UNKNOWN_SKILL_CHOICE");
  }
  const skillProficiencies = [...new Set([...selectedSkills, ...fixedSkills])].sort();
  if (skillProficiencies.some((key) => catalog.skills[key] === undefined)) throw new Error("UNKNOWN_CHARACTER_CHOICE");
  const expertise = unique(draft.expertiseKeys ?? [], "INVALID_EXPERTISE_CHOICES");
  if (expertise.length !== (characterClass.expertise ?? 0)
    || expertise.some((key) => !skillProficiencies.includes(key) && key !== "thieves-tools")) {
    throw new Error("INVALID_EXPERTISE_CHOICES");
  }

  const featureGroups = [...(ancestry.optionGroups ?? []), ...(characterClass.optionGroups ?? []), ...(background.optionGroups ?? [])];
  const featureKeys = unique(draft.featureChoiceKeys ?? [], "INVALID_FEATURE_CHOICES");
  const selectedFeatures = featureGroups.flatMap((group) => {
    const selected = group.options.filter((option) => featureKeys.includes(`${group.key}:${option.key}`));
    if (selected.length !== group.count) throw new Error("INVALID_FEATURE_CHOICES");
    return selected.map((option) => ({ label: group.label, name: option.name, proficiency: group.proficiency }));
  });
  if (selectedFeatures.length !== featureKeys.length) throw new Error("INVALID_FEATURE_CHOICES");
  const fixedLanguages = [...new Set([...(ancestry.languages ?? []), ...(characterClass.languages ?? []), ...(background.languages ?? [])])];
  const chosenLanguages = unique((draft.languageChoices ?? []).map((name) => name.toLowerCase()), "INVALID_LANGUAGE_CHOICES");
  const languages = ["Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
    "Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon"];
  if (chosenLanguages.length !== (ancestry.languageChoices ?? 0) + (background.languageChoices ?? 0)
    || chosenLanguages.some((name) => !languages.some((item) => item.toLowerCase() === name)
      || fixedLanguages.some((item) => item.toLowerCase() === name))) throw new Error("INVALID_LANGUAGE_CHOICES");

  const selectedEquipmentKeys = unique(draft.equipmentChoiceKeys, "INVALID_EQUIPMENT_CHOICE_COUNT");
  const knownEquipmentChoices = new Set(characterClass.equipmentChoiceGroups.flatMap((group) => group.choices.map((choice) => choice.key)));
  if (selectedEquipmentKeys.some((key) => !knownEquipmentChoices.has(key))) throw new Error("UNKNOWN_EQUIPMENT_CHOICE");

  const chosenEquipmentIds: string[] = [];
  for (const group of characterClass.equipmentChoiceGroups) {
    const selected = group.choices.filter((choice) => selectedEquipmentKeys.includes(choice.key));
    if (selected.length !== group.count) throw new Error("INVALID_EQUIPMENT_CHOICE_COUNT");
    if (draft.classKey === "cleric" && selected.some(({ key }) => key === "weapon-warhammer")
      && !ancestry.proficiencies?.includes("Warhammer")) throw new Error("EQUIPMENT_REQUIRES_PROFICIENCY");
    chosenEquipmentIds.push(...selected.flatMap((choice) => choice.equipmentIds));
  }
  const equipmentQuantities: Record<string, number> = {};
  for (const id of [...characterClass.fixedEquipmentIds, ...background.equipmentIds, ...chosenEquipmentIds]) {
    equipmentQuantities[id] = (equipmentQuantities[id] ?? 0) + 1;
  }
  const equipmentIds = Object.keys(equipmentQuantities).sort();
  const equipment = equipmentIds.map((id) => requireChoice(catalog.equipment[id]));

  const spellKeys = unique(draft.spellKeys, "INVALID_SPELL_CHOICE_COUNT");
  const casting = characterClass.spellcasting;
  const prepared = unique(draft.preparedSpellKeys ?? [], "INVALID_PREPARED_SPELLS");
  const spellbook: string[] = [];
  const granted = casting?.grantedSpellKeys ?? [];
  let castable = spellKeys;
  if (!casting) {
    if (spellKeys.length || prepared.length) throw new Error("INVALID_SPELL_CHOICE_COUNT");
  } else {
    if (spellKeys.some((key) => !casting.availableSpellKeys.includes(key) || catalog.spells[key] === undefined)) {
      throw new Error("UNKNOWN_SPELL_CHOICE");
    }
    if (casting.ability) {
      const cantrips = spellKeys.filter((key) => catalog.spells[key]!.level === 0);
      const leveled = spellKeys.filter((key) => catalog.spells[key]!.level === 1);
      const preparedCount = Math.max(1, 1 + modifier(abilities[casting.ability]));
      const count = casting.spellbookCount ?? (casting.selectionMode === "PREPARED" ? preparedCount : casting.choiceCount);
      if (cantrips.length !== casting.cantripCount || leveled.length !== count || spellKeys.length !== cantrips.length + leveled.length
        || leveled.some((key) => granted.includes(key))) throw new Error("INVALID_SPELL_CHOICE_COUNT");
      if (casting.spellbookCount !== undefined) {
        spellbook.push(...leveled);
        if (prepared.length !== preparedCount || prepared.some((key) => !leveled.includes(key))) {
          throw new Error("INVALID_PREPARED_SPELLS");
        }
        castable = [...cantrips, ...prepared];
      } else if (prepared.length) throw new Error("INVALID_PREPARED_SPELLS");
    } else if (spellKeys.length !== casting.choiceCount || prepared.length) throw new Error("INVALID_SPELL_CHOICE_COUNT");
  }
  const racialCantrip = draft.ancestryCantripKey;
  if (ancestry.cantripOptions
    ? !racialCantrip || !ancestry.cantripOptions.includes(racialCantrip)
    : racialCantrip !== undefined) throw new Error("INVALID_ANCESTRY_CANTRIP");
  const spell = (key: string) => requireChoice(catalog.spells[key]);
  const availableSpells = [...new Set([...castable, ...granted, ...(ancestry.grantedSpells ?? []), ...(racialCantrip ? [racialCantrip] : [])])];
  const spells = availableSpells.map((key) => spell(key).id).sort();

  const proficiencyBonus = 2;
  const saveProficiencies = unique(characterClass.savingThrowAbilities, "INVALID_SAVE_PROFICIENCIES");
  const saves = Object.fromEntries(ABILITIES.map((ability) => [
    ability,
    modifier(abilities[ability]) + (saveProficiencies.includes(ability) ? proficiencyBonus : 0),
  ])) as Record<AbilityName, number>;
  const skills = Object.fromEntries(skillProficiencies.map((key) => {
    const skill = requireChoice(catalog.skills[key]);
    return [key, modifier(abilities[skill.ability]) + proficiencyBonus * (expertise.includes(key) ? 2 : 1)];
  }));

  const resourceOptions = [...characterClass.resources, ...(ancestry.resources ?? [])];
  const resources = Object.fromEntries(resourceOptions.sort((left, right) => left.id.localeCompare(right.id)).map((resource) => {
    const maximum = resource.ability ? Math.max(resource.maximum, modifier(abilities[resource.ability]) + (resource.extra ?? 0)) : resource.maximum;
    return [resource.id, { id: resource.id, name: resource.name, current: maximum, maximum }];
  }));
  const armors = equipment.filter((item) => item.armorClass !== undefined)
    .sort((left, right) => armorClass(right.armorClass!, abilities) - armorClass(left.armorClass!, abilities));
  const shield = equipment.find((item) => item.shieldBonus);
  const unarmored = armorClass(characterClass.unarmoredArmorClass, abilities);
  const worn = armors[0] && armorClass(armors[0].armorClass!, abilities) >= unarmored ? armors[0] : undefined;
  const shieldAllowed = !(characterClass.unarmoredArmorClass.secondAbility === "wisdom" && !worn);
  const wieldedShield = shieldAllowed ? shield : undefined;
  const defense = worn && featureKeys.includes("fighting-style:defense") ? 1 : 0;
  const armorPenalty = worn?.armorClass?.strengthRequirement && draft.ancestryKey !== "hill-dwarf"
    && abilities.strength < worn.armorClass.strengthRequirement ? 10 : 0;
  const equipmentSlots = Object.fromEntries([
    ...(worn ? [[worn.id, ["armor"]]] : []),
    ...(wieldedShield ? [[wieldedShield.id, ["off-hand"]]] : []),
  ]);
  const spellcasting = casting?.ability ? {
    ability: casting.ability,
    saveDc: 8 + proficiencyBonus + modifier(abilities[casting.ability]),
    attackBonus: proficiencyBonus + modifier(abilities[casting.ability]),
    slotRecovery: casting.pact ? "SHORT_REST" : "LONG_REST",
    spellbook: spellbook.map((key) => spell(key).id),
    spellLevels: Object.fromEntries(availableSpells.map((key) => [spell(key).id, spell(key).level])),
    spellNames: Object.fromEntries([...availableSpells, ...spellbook].map((key) => [spell(key).id, spell(key).displayName])),
  } : undefined;
  const features = [ancestry, characterClass, background].flatMap((option) => (option.features ?? []).map(({ name }) => name));
  const mechanics = ancestry.features || characterClass.features ? {
    proficiencies: [...new Set([
      ...(ancestry.proficiencies ?? []), ...(characterClass.proficiencies ?? []), ...(background.proficiencies ?? []),
      ...selectedFeatures.filter((option) => option.proficiency).map((option) => option.name),
    ])],
    languages: [...fixedLanguages, ...languages.filter((name) => chosenLanguages.includes(name.toLowerCase()))],
    features: [...features, ...selectedFeatures.filter((option) => !option.proficiency).map((option) => `${option.label} (${option.name})`)],
    expertise,
    ...(spellcasting ? { spellcasting } : {}),
    ...(racialCantrip ? { ancestryCantrip: { id: spell(racialCantrip).id, name: spell(racialCantrip).displayName, ability: "intelligence" } }
      : ancestry.grantedSpells?.length ? { ancestryCantrip: { id: spell(ancestry.grantedSpells[0]!).id, name: spell(ancestry.grantedSpells[0]!).displayName, ability: "charisma" } } : {}),
  } : undefined;
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
    ...[...availableSpells, ...spellbook].map((key) => spell(key).sourceReferenceId),
    ...resourceOptions.map((resource) => resource.sourceReferenceId),
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
    maxHp: characterClass.hitDie + modifier(abilities.constitution) + (ancestry.hpBonus ?? 0) + (characterClass.hpBonus ?? 0),
    armorClass: (worn ? armorClass(worn.armorClass!, abilities) : unarmored) + (wieldedShield?.shieldBonus ?? 0) + defense,
    saves,
    saveProficiencies,
    skills,
    skillProficiencies,
    speed: ancestry.speed - armorPenalty,
    equipmentIds, equipmentQuantities, equipmentSlots,
    ...(mechanics ? { mechanics } : {}),
    resources,
    spells,
    spellSlots,
    featureSourceReferenceIds,
    sourceReferenceIds,
  });
}
