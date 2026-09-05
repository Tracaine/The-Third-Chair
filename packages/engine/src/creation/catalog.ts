import type { AbilityName } from "@third-chair/contracts";

export interface CatalogChoice {
  readonly key: string;
  readonly displayName: string;
  readonly sourceReferenceId: string;
}

export interface CharacterCatalog {
  readonly skills: Readonly<Record<string, CatalogChoice & { readonly ability: AbilityName }>>;
  readonly ancestries: Readonly<Record<string, CatalogChoice & {
    readonly abilityBonuses: Readonly<Partial<Record<AbilityName, number>>>;
    readonly speed: number;
    readonly featureSourceReferenceIds: readonly string[];
  }>>;
  readonly classes: Readonly<Record<string, CatalogChoice & {
    readonly hitDie: number;
    readonly savingThrowAbilities: readonly AbilityName[];
    readonly skillChoice: { readonly count: number; readonly options: readonly string[] };
    readonly fixedEquipmentIds: readonly string[];
    readonly equipmentChoiceGroups: readonly {
      readonly key: string;
      readonly count: number;
      readonly choices: readonly { readonly key: string; readonly equipmentIds: readonly string[] }[];
    }[];
    readonly unarmoredArmorClass: ArmorClassFormula;
    readonly resources: readonly {
      readonly id: string;
      readonly name: string;
      readonly maximum: number;
      readonly sourceReferenceId: string;
    }[];
    readonly spellcasting: null | {
      readonly selectionMode: "KNOWN" | "PREPARED";
      readonly choiceCount: number;
      readonly availableSpellKeys: readonly string[];
      readonly slots: Readonly<Record<string, number>>;
    };
    readonly featureSourceReferenceIds: readonly string[];
  }>>;
  readonly backgrounds: Readonly<Record<string, CatalogChoice & {
    readonly skillProficiencies: readonly string[];
    readonly equipmentIds: readonly string[];
    readonly featureSourceReferenceIds: readonly string[];
  }>>;
  readonly equipment: Readonly<Record<string, {
    readonly id: string;
    readonly displayName: string;
    readonly armorClass?: ArmorClassFormula;
    readonly sourceReferenceId: string;
  }>>;
  readonly spells: Readonly<Record<string, CatalogChoice & {
    readonly id: string;
    readonly level: number;
  }>>;
}

export interface ArmorClassFormula {
  readonly base: number;
  readonly ability: AbilityName | null;
  readonly maximumAbilityModifier?: number;
}

export interface CharacterChoiceLists {
  readonly ancestries: readonly CatalogChoice[];
  readonly classes: readonly CatalogChoice[];
  readonly backgrounds: readonly CatalogChoice[];
  readonly equipment: readonly CatalogChoice[];
  readonly spells: readonly CatalogChoice[];
}

function choices(record: Readonly<Record<string, CatalogChoice>>): CatalogChoice[] {
  return Object.values(record)
    .map(({ key, displayName, sourceReferenceId }) => ({ key, displayName, sourceReferenceId }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function listCharacterChoices(catalog: CharacterCatalog): CharacterChoiceLists {
  return {
    ancestries: choices(catalog.ancestries),
    classes: choices(catalog.classes),
    backgrounds: choices(catalog.backgrounds),
    equipment: Object.values(catalog.equipment)
      .map(({ id: key, displayName, sourceReferenceId }) => ({ key, displayName, sourceReferenceId }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    spells: choices(catalog.spells),
  };
}
