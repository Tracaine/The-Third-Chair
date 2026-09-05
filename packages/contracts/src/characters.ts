import { z } from "zod";
import { PersistedIdSchema, PlayerSeatSchema } from "./ids.js";

const ChoiceKeySchema = z.string().trim().min(1).max(200);
const SourceReferenceIdSchema = z.string().trim().min(1).max(300);
const CharacterTextSchema = z.string().trim().max(500);

export const AbilityNameSchema = z.enum([
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
]);

export const AbilityScoresSchema = z.object({
  strength: z.number().int(),
  dexterity: z.number().int(),
  constitution: z.number().int(),
  intelligence: z.number().int(),
  wisdom: z.number().int(),
  charisma: z.number().int(),
}).strict();

export const CharacterDraftSchema = z.object({
  actorId: PersistedIdSchema,
  controller: PlayerSeatSchema,
  name: z.string().trim().min(1).max(80),
  pronouns: z.string().trim().max(80),
  ancestryKey: ChoiceKeySchema,
  classKey: ChoiceKeySchema,
  backgroundKey: ChoiceKeySchema,
  abilityMethod: z.literal("STANDARD_ARRAY"),
  abilities: AbilityScoresSchema,
  skillKeys: z.array(ChoiceKeySchema),
  equipmentChoiceKeys: z.array(ChoiceKeySchema),
  spellKeys: z.array(ChoiceKeySchema),
  characterHook: CharacterTextSchema,
}).strict();

export const CharacterResourceSchema = z.object({
  id: PersistedIdSchema,
  name: z.string().trim().min(1).max(200),
  current: z.number().int().nonnegative(),
  maximum: z.number().int().nonnegative(),
}).strict();

export const SpellSlotStateSchema = z.object({
  current: z.number().int().nonnegative(),
  maximum: z.number().int().nonnegative(),
}).strict();

export const CharacterBuildSchema = CharacterDraftSchema.pick({
  actorId: true,
  controller: true,
  name: true,
  pronouns: true,
  characterHook: true,
}).extend({
  level: z.literal(1),
  ancestrySourceKey: ChoiceKeySchema,
  classSourceKey: ChoiceKeySchema,
  backgroundSourceKey: ChoiceKeySchema,
  abilities: AbilityScoresSchema,
  proficiencyBonus: z.number().int().positive(),
  maxHp: z.number().int().positive(),
  armorClass: z.number().int().nonnegative(),
  saves: z.record(AbilityNameSchema, z.number().int()),
  saveProficiencies: z.array(AbilityNameSchema),
  skills: z.record(ChoiceKeySchema, z.number().int()),
  skillProficiencies: z.array(ChoiceKeySchema),
  speed: z.number().int().nonnegative(),
  equipmentIds: z.array(PersistedIdSchema),
  resources: z.record(PersistedIdSchema, CharacterResourceSchema),
  spells: z.array(PersistedIdSchema),
  spellSlots: z.record(z.string().regex(/^[1-9]$/), SpellSlotStateSchema),
  featureSourceReferenceIds: z.array(SourceReferenceIdSchema),
  sourceReferenceIds: z.array(SourceReferenceIdSchema),
}).strict();

export type AbilityName = z.infer<typeof AbilityNameSchema>;
export type AbilityScores = z.infer<typeof AbilityScoresSchema>;
export type CharacterDraft = z.infer<typeof CharacterDraftSchema>;
export type CharacterBuild = z.infer<typeof CharacterBuildSchema>;
export type CharacterResource = z.infer<typeof CharacterResourceSchema>;
export type SpellSlotState = z.infer<typeof SpellSlotStateSchema>;
