import type { SourcePackService } from "@third-chair/contracts";
import { characterCatalogFromSourceOptions, listCharacterChoices } from "@third-chair/engine";
import { z } from "zod";
import { toMcpResult } from "../result.js";

const Key = z.string().trim().min(1).max(200);
const ChoiceSchema = z.object({ key: Key, displayName: Key, sourceReferenceId: z.string() }).strict();
const InputSchema = z.object({
  ancestryKey: Key.optional(),
  classKey: Key.optional(),
  equipmentGroup: Key.optional(),
  equipmentSearch: z.string().trim().max(200).optional(),
  offset: z.number().int().nonnegative().default(0),
}).strict();
const OutputSchema = z.object({
  ancestries: z.array(ChoiceSchema),
  classes: z.array(ChoiceSchema),
  backgrounds: z.array(ChoiceSchema),
  // These objects are sourced from the validated catalog, and each field is a mechanical choice.
  ancestry: z.record(z.string(), z.unknown()).optional(),
  characterClass: z.record(z.string(), z.unknown()).optional(),
  equipment: z.object({
    total: z.number().int().nonnegative(),
    nextOffset: z.number().int().nonnegative().nullable(),
    choices: z.array(z.object({ key: Key, displayName: Key }).strict()),
  }).strict().optional(),
}).strict();

export const listCharacterOptionsDescriptor = {
  name: "list_character_options",
  description: "Browse sourced level-one ancestries, classes, and backgrounds before advanced creation. Supply ancestryKey or classKey for choices and exact draft keys. Supply classKey and equipmentGroup to browse equipment choices, optionally filtering by equipmentSearch.",
  inputSchema: InputSchema.shape,
  outputSchema: OutputSchema.shape,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
} as const;

export function readCharacterOptions(sourcePack: SourcePackService, raw: unknown) {
  const input = InputSchema.parse(raw);
  const rows = sourcePack.characterOptions?.() ?? [];
  if (rows.length === 0) throw new Error("SOURCE_PACK_REBUILD_REQUIRED_FOR_CHARACTER_CREATION");
  const catalog = characterCatalogFromSourceOptions(rows);
  const { ancestries, classes, backgrounds } = listCharacterChoices(catalog);
  const ancestry = input.ancestryKey ? catalog.ancestries[input.ancestryKey] : undefined;
  const selectedClass = input.classKey ? catalog.classes[input.classKey] : undefined;
  if (input.ancestryKey && !ancestry || input.classKey && !selectedClass) throw new Error("UNKNOWN_CHARACTER_CHOICE");

  const group = input.equipmentGroup ? selectedClass?.equipmentChoiceGroups.find(({ key }) => key === input.equipmentGroup) : undefined;
  if (input.equipmentGroup && !group) throw new Error("UNKNOWN_EQUIPMENT_GROUP");
  const search = input.equipmentSearch?.toLowerCase() ?? "";
  const matches = group?.choices.filter(({ key, displayName }) => `${key} ${displayName ?? ""}`.toLowerCase().includes(search));
  const pageSize = 30;
  const characterClass = selectedClass ? {
    ...selectedClass,
    fixedEquipmentIds: selectedClass.fixedEquipmentIds.map((id) => catalog.equipment[id]?.displayName ?? id),
    equipmentChoiceGroups: selectedClass.equipmentChoiceGroups.map(({ key, count, choices }) => ({ key, count, available: choices.length })),
    spellcasting: selectedClass.spellcasting && {
      ...selectedClass.spellcasting,
      spells: selectedClass.spellcasting.availableSpellKeys.map((key) => {
        const spell = catalog.spells[key]!;
        return { key, name: spell.displayName, level: spell.level };
      }),
    },
  } : undefined;
  return toMcpResult(OutputSchema, {
    ancestries, classes, backgrounds,
    ...(ancestry ? { ancestry } : {}),
    ...(characterClass ? { characterClass } : {}),
    ...(matches ? { equipment: {
      total: matches.length,
      nextOffset: input.offset + pageSize < matches.length ? input.offset + pageSize : null,
      choices: matches.slice(input.offset, input.offset + pageSize).map(({ key, displayName }) => ({ key, displayName: displayName ?? key })),
    } } : {}),
  }, "Level-one character options from the installed SRD 5.1 source pack.");
}
