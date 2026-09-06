import { AbilityNameSchema, type AbilityName, type StructuredCharacterOption } from "@third-chair/contracts";
import { z } from "zod";

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

const KeySchema = z.string().trim().min(1).max(200);
const SourceIdSchema = z.string().trim().min(1).max(300);
const ArmorClassFormulaSchema = z.object({
  base: z.number().int().nonnegative(),
  ability: AbilityNameSchema.nullable(),
  maximumAbilityModifier: z.number().int().optional(),
}).strict();
const SkillSchema = z.object({
  key: KeySchema,
  displayName: z.string().trim().min(1).max(200),
  ability: AbilityNameSchema,
  sourceReferenceId: SourceIdSchema,
}).strict();
const SkillsField = { skills: z.record(KeySchema, SkillSchema).optional() };
const AncestryPayloadSchema = z.object({
  abilityBonuses: z.partialRecord(AbilityNameSchema, z.number().int()), speed: z.number().int().nonnegative(),
  featureSourceReferenceIds: z.array(SourceIdSchema), ...SkillsField,
}).strict();
const ClassPayloadSchema = z.object({
  hitDie: z.number().int().positive(), savingThrowAbilities: z.array(AbilityNameSchema),
  skillChoice: z.object({ count: z.number().int().nonnegative(), options: z.array(KeySchema) }).strict(),
  fixedEquipmentIds: z.array(KeySchema),
  equipmentChoiceGroups: z.array(z.object({ key: KeySchema, count: z.number().int().positive(), choices: z.array(z.object({ key: KeySchema, equipmentIds: z.array(KeySchema) }).strict()) }).strict()),
  unarmoredArmorClass: ArmorClassFormulaSchema,
  resources: z.array(z.object({ id: KeySchema, name: z.string().trim().min(1).max(200), maximum: z.number().int().nonnegative(), sourceReferenceId: SourceIdSchema }).strict()),
  spellcasting: z.object({ selectionMode: z.enum(["KNOWN", "PREPARED"]), choiceCount: z.number().int().nonnegative(), availableSpellKeys: z.array(KeySchema), slots: z.record(z.string().regex(/^[1-9]$/), z.number().int().nonnegative()) }).strict().nullable(),
  featureSourceReferenceIds: z.array(SourceIdSchema), ...SkillsField,
}).strict();
const BackgroundPayloadSchema = z.object({
  skillProficiencies: z.array(KeySchema), equipmentIds: z.array(KeySchema),
  featureSourceReferenceIds: z.array(SourceIdSchema), ...SkillsField,
}).strict();
const EquipmentPayloadSchema = z.object({ armorClass: ArmorClassFormulaSchema.optional(), ...SkillsField }).strict();
const SpellPayloadSchema = z.object({ id: KeySchema, level: z.number().int().nonnegative(), ...SkillsField }).strict();

function exactArmorFormula(value: z.infer<typeof ArmorClassFormulaSchema>): ArmorClassFormula {
  return { base: value.base, ability: value.ability,
    ...(value.maximumAbilityModifier === undefined ? {} : { maximumAbilityModifier: value.maximumAbilityModifier }) };
}

export function characterCatalogFromSourceOptions(options: readonly StructuredCharacterOption[]): CharacterCatalog {
  const catalog: {
    skills: Record<string, CatalogChoice & { ability: AbilityName }>;
    ancestries: Record<string, CharacterCatalog["ancestries"][string]>;
    classes: Record<string, CharacterCatalog["classes"][string]>;
    backgrounds: Record<string, CharacterCatalog["backgrounds"][string]>;
    equipment: Record<string, CharacterCatalog["equipment"][string]>;
    spells: Record<string, CharacterCatalog["spells"][string]>;
  } = { skills: {}, ancestries: {}, classes: {}, backgrounds: {}, equipment: {}, spells: {} };
  const seen = new Set<string>();
  for (const row of options) {
    const identity = `${row.optionKind}:${row.optionKey}`;
    if (seen.has(identity)) throw new Error("DUPLICATE_CHARACTER_OPTION");
    seen.add(identity);
    const base = { key: row.optionKey, displayName: row.displayName, sourceReferenceId: row.ruleSectionId };
    let skills: Record<string, z.infer<typeof SkillSchema>> = {};
    if (row.optionKind === "ANCESTRY") {
      const parsed = AncestryPayloadSchema.parse(row.optionJson);
      const { skills: suppliedSkills, ...fields } = parsed;
      skills = suppliedSkills ?? {};
      catalog.ancestries[row.optionKey] = { ...base, ...fields } as CharacterCatalog["ancestries"][string];
    } else if (row.optionKind === "CLASS") {
      const parsed = ClassPayloadSchema.parse(row.optionJson);
      const { skills: suppliedSkills, ...fields } = parsed;
      skills = suppliedSkills ?? {};
      catalog.classes[row.optionKey] = { ...base, ...fields } as CharacterCatalog["classes"][string];
    } else if (row.optionKind === "BACKGROUND") {
      const parsed = BackgroundPayloadSchema.parse(row.optionJson);
      const { skills: suppliedSkills, ...fields } = parsed;
      skills = suppliedSkills ?? {};
      catalog.backgrounds[row.optionKey] = { ...base, ...fields } as CharacterCatalog["backgrounds"][string];
    } else if (row.optionKind === "EQUIPMENT") {
      const parsed = EquipmentPayloadSchema.parse(row.optionJson);
      skills = parsed.skills ?? {};
      catalog.equipment[row.optionKey] = { id: row.optionKey, displayName: row.displayName,
        sourceReferenceId: row.ruleSectionId, ...(parsed.armorClass ? { armorClass: exactArmorFormula(parsed.armorClass) } : {}) };
    } else {
      const parsed = SpellPayloadSchema.parse(row.optionJson);
      const { skills: suppliedSkills, ...fields } = parsed;
      skills = suppliedSkills ?? {};
      catalog.spells[row.optionKey] = { ...base, ...fields } as CharacterCatalog["spells"][string];
    }
    for (const [key, skill] of Object.entries(skills)) {
      if (key !== skill.key) throw new Error("CHARACTER_SKILL_KEY_MISMATCH");
      const existing = catalog.skills[key];
      if (existing && JSON.stringify(existing) !== JSON.stringify(skill)) throw new Error("CONFLICTING_CHARACTER_SKILL");
      catalog.skills[key] = skill;
    }
  }
  return catalog;
}
