import { AbilityNameSchema, type AbilityName, type StructuredCharacterOption } from "@third-chair/contracts";
import { z } from "zod";

export interface CatalogChoice {
  readonly key: string;
  readonly displayName: string;
  readonly sourceReferenceId: string;
}

export interface FeatureChoiceGroup {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly options: readonly { readonly key: string; readonly name: string }[];
  readonly proficiency?: boolean;
}

interface SourceMechanics {
  readonly proficiencies?: readonly string[];
  readonly features?: readonly { readonly name: string; readonly detail?: string }[];
  readonly languages?: readonly string[];
  readonly optionGroups?: readonly FeatureChoiceGroup[];
  readonly hpBonus?: number;
}

interface ResourceOption {
  readonly id: string;
  readonly name: string;
  readonly maximum: number;
  readonly ability?: AbilityName;
  readonly extra?: number;
  readonly sourceReferenceId: string;
}

export interface CharacterCatalog {
  readonly skills: Readonly<Record<string, CatalogChoice & { readonly ability: AbilityName }>>;
  readonly ancestries: Readonly<Record<string, CatalogChoice & {
    readonly skillProficiencies?: readonly string[];
    readonly languageChoices?: number;
    readonly skillChoices?: number;
    readonly abilityChoices?: number;
    readonly resources?: readonly ResourceOption[];
    readonly cantripOptions?: readonly string[];
    readonly grantedSpells?: readonly string[];
    readonly abilityBonuses: Readonly<Partial<Record<AbilityName, number>>>;
    readonly speed: number;
    readonly featureSourceReferenceIds: readonly string[];
  } & SourceMechanics>>;
  readonly classes: Readonly<Record<string, CatalogChoice & {
    readonly hitDie: number;
    readonly savingThrowAbilities: readonly AbilityName[];
    readonly skillChoice: { readonly count: number; readonly options: readonly string[] };
    readonly fixedEquipmentIds: readonly string[];
    readonly equipmentChoiceGroups: readonly {
      readonly key: string;
      readonly count: number;
      readonly choices: readonly { readonly key: string; readonly displayName?: string; readonly equipmentIds: readonly string[] }[];
    }[];
    readonly unarmoredArmorClass: ArmorClassFormula;
    readonly resources: readonly ResourceOption[];
    readonly expertise?: number;
    readonly spellcasting: null | {
      readonly selectionMode: "KNOWN" | "PREPARED";
      readonly choiceCount: number;
      readonly availableSpellKeys: readonly string[];
      readonly slots: Readonly<Record<string, number>>;
      readonly ability?: AbilityName;
      readonly cantripCount?: number;
      readonly spellbookCount?: number;
      readonly grantedSpellKeys?: readonly string[];
      readonly pact?: boolean;
    };
    readonly featureSourceReferenceIds: readonly string[];
  } & SourceMechanics>>;
  readonly backgrounds: Readonly<Record<string, CatalogChoice & {
    readonly skillProficiencies: readonly string[];
    readonly equipmentIds: readonly string[];
    readonly featureSourceReferenceIds: readonly string[];
    readonly languageChoices?: number;
  } & SourceMechanics>>;
  readonly equipment: Readonly<Record<string, {
    readonly id: string;
    readonly displayName: string;
    readonly armorClass?: ArmorClassFormula;
    readonly shieldBonus?: number;
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
  readonly secondAbility?: AbilityName;
  readonly strengthRequirement?: number;
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
  secondAbility: AbilityNameSchema.optional(),
  strengthRequirement: z.number().int().positive().optional(),
}).strict();
const SkillSchema = z.object({
  key: KeySchema,
  displayName: z.string().trim().min(1).max(200),
  ability: AbilityNameSchema,
  sourceReferenceId: SourceIdSchema,
}).strict();
const SkillsField = { skills: z.record(KeySchema, SkillSchema).optional() };
const ResourceOptionSchema = z.object({
  id: KeySchema, name: KeySchema, maximum: z.number().int().nonnegative(), sourceReferenceId: SourceIdSchema,
  ability: AbilityNameSchema.optional(), extra: z.number().int().optional(),
}).strict();
const FeatureChoiceSchema = z.object({
  key: KeySchema, label: KeySchema, count: z.number().int().positive(),
  options: z.array(z.object({ key: KeySchema, name: KeySchema }).strict()), proficiency: z.boolean().optional(),
}).strict();
const MechanicsFields = {
  features: z.array(z.object({ name: KeySchema, detail: KeySchema.optional() }).strict()).optional(),
  proficiencies: z.array(KeySchema).optional(), languages: z.array(KeySchema).optional(),
  optionGroups: z.array(FeatureChoiceSchema).optional(), hpBonus: z.number().int().nonnegative().optional(),
};
const AncestryPayloadSchema = z.object({
  ...MechanicsFields, languageChoices: z.number().int().nonnegative().optional(),
  skillChoices: z.number().int().nonnegative().optional(), abilityChoices: z.number().int().nonnegative().optional(),
  skillProficiencies: z.array(KeySchema).optional(), cantripOptions: z.array(KeySchema).optional(),
  grantedSpells: z.array(KeySchema).optional(), resources: z.array(ResourceOptionSchema).optional(),
  abilityBonuses: z.partialRecord(AbilityNameSchema, z.number().int()), speed: z.number().int().nonnegative(),
  featureSourceReferenceIds: z.array(SourceIdSchema), ...SkillsField,
}).strict();
const ClassPayloadSchema = z.object({
  ...MechanicsFields, expertise: z.number().int().nonnegative().optional(),
  hitDie: z.number().int().positive(), savingThrowAbilities: z.array(AbilityNameSchema),
  skillChoice: z.object({ count: z.number().int().nonnegative(), options: z.array(KeySchema) }).strict(),
  fixedEquipmentIds: z.array(KeySchema),
  equipmentChoiceGroups: z.array(z.object({ key: KeySchema, count: z.number().int().positive(), choices: z.array(z.object({ key: KeySchema, displayName: KeySchema.optional(), equipmentIds: z.array(KeySchema) }).strict()) }).strict()),
  unarmoredArmorClass: ArmorClassFormulaSchema,
  resources: z.array(ResourceOptionSchema),
  spellcasting: z.object({ ability: AbilityNameSchema.optional(), cantripCount: z.number().int().nonnegative().optional(),
    spellbookCount: z.number().int().positive().optional(), grantedSpellKeys: z.array(KeySchema).optional(), pact: z.boolean().optional(),
    selectionMode: z.enum(["KNOWN", "PREPARED"]), choiceCount: z.number().int().nonnegative(), availableSpellKeys: z.array(KeySchema), slots: z.record(z.string().regex(/^[1-9]$/), z.number().int().nonnegative()) }).strict().nullable(),
  featureSourceReferenceIds: z.array(SourceIdSchema), ...SkillsField,
}).strict();
const BackgroundPayloadSchema = z.object({
  ...MechanicsFields, languageChoices: z.number().int().nonnegative().optional(),
  skillProficiencies: z.array(KeySchema), equipmentIds: z.array(KeySchema),
  featureSourceReferenceIds: z.array(SourceIdSchema), ...SkillsField,
}).strict();
const EquipmentPayloadSchema = z.object({ armorClass: ArmorClassFormulaSchema.optional(), shieldBonus: z.number().int().positive().optional(), ...SkillsField }).strict();
const SpellPayloadSchema = z.object({ id: KeySchema, level: z.number().int().nonnegative(), ...SkillsField }).strict();

function exactArmorFormula(value: z.infer<typeof ArmorClassFormulaSchema>): ArmorClassFormula {
  const { maximumAbilityModifier, secondAbility, strengthRequirement } = value;
  return { base: value.base, ability: value.ability,
    ...(maximumAbilityModifier === undefined ? {} : { maximumAbilityModifier }),
    ...(secondAbility === undefined ? {} : { secondAbility }),
    ...(strengthRequirement === undefined ? {} : { strengthRequirement }),
  };
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
        sourceReferenceId: row.ruleSectionId, ...(parsed.armorClass ? { armorClass: exactArmorFormula(parsed.armorClass) } : {}),
        ...(parsed.shieldBonus ? { shieldBonus: parsed.shieldBonus } : {}) };
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
