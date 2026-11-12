import { createHash } from "node:crypto";
import type { StructuredCharacterOption } from "@third-chair/contracts";
import type { RuleSection, SourceChunk } from "../indexing/types.js";
import { slugHeading } from "./headings.js";

const list = (values: string) => values.split("|").map((value) => value.trim());
const keys = (values: string) => list(values).map(slugHeading);
const words = (value: string) => value.replace(/\s+/g, " ").trim();
const slugId = (prefix: string, name: string) => {
  const hex = createHash("sha256").update(`srd-5.1:${prefix}:${name}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const skillGroups = {
  strength: "Athletics", dexterity: "Acrobatics|Sleight of Hand|Stealth",
  intelligence: "Arcana|History|Investigation|Nature|Religion",
  wisdom: "Animal Handling|Insight|Medicine|Perception|Survival",
  charisma: "Deception|Intimidation|Performance|Persuasion",
};
const allSkills = Object.values(skillGroups).join("|");
const feature = (name: string, detail?: string) => ({ name, ...(detail ? { detail } : {}) });
const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const ancestryRows = [
  { name: "Hill Dwarf", page: 4, bonuses: { constitution: 2, wisdom: 1 }, speed: 25, hpBonus: 1,
    features: "Darkvision|Dwarven Resilience|Dwarven Combat Training|Stonecunning|Dwarven Toughness",
    proficiencies: "Battleaxe|Handaxe|Light Hammer|Warhammer", languages: "Common|Dwarvish", choices: ["Dwarven tool: Smith’s tools|Brewer’s supplies|Mason’s tools"] },
  { name: "High Elf", page: 4, bonuses: { dexterity: 2, intelligence: 1 }, speed: 30, skills: "Perception",
    features: "Darkvision|Keen Senses|Fey Ancestry|Trance|Elf Weapon Training|Wizard Cantrip",
    proficiencies: "Longsword|Shortsword|Shortbow|Longbow", languages: "Common|Elvish", languageChoices: 1, cantripClass: "wizard" },
  { name: "Lightfoot Halfling", page: 5, bonuses: { dexterity: 2, charisma: 1 }, speed: 25,
    features: "Lucky|Brave|Halfling Nimbleness|Naturally Stealthy", languages: "Common|Halfling" },
  { name: "Human", page: 5, bonuses: Object.fromEntries(abilities.map((key) => [key, 1])), speed: 30,
    features: "", languages: "Common", languageChoices: 1 },
  { name: "Dragonborn", page: 5, bonuses: { strength: 2, charisma: 1 }, speed: 30,
    features: "Draconic Ancestry|Breath Weapon|Damage Resistance", languages: "Common|Draconic",
    choices: ["Draconic ancestry: Black (acid, line)|Blue (lightning, line)|Brass (fire, line)|Bronze (lightning, line)|Copper (acid, line)|Gold (fire, cone)|Green (poison, cone)|Red (fire, cone)|Silver (cold, cone)|White (cold, cone)"], resources: [["Breath Weapon", 1]] as const },
  { name: "Rock Gnome", page: 6, bonuses: { intelligence: 2, constitution: 1 }, speed: 25,
    features: "Darkvision|Gnome Cunning|Artificer’s Lore|Tinker", proficiencies: "Tinker’s Tools", languages: "Common|Gnomish" },
  { name: "Half-Elf", page: 6, bonuses: { charisma: 2 }, speed: 30, abilityChoices: 2, skillChoices: 2,
    features: "Darkvision|Fey Ancestry|Skill Versatility", languages: "Common|Elvish", languageChoices: 1 },
  { name: "Half-Orc", page: 7, bonuses: { strength: 2, constitution: 1 }, speed: 30, skills: "Intimidation",
    features: "Darkvision|Menacing|Relentless Endurance|Savage Attacks", languages: "Common|Orc", resources: [["Relentless Endurance", 1]] as const },
  { name: "Tiefling", page: 7, bonuses: { intelligence: 1, charisma: 2 }, speed: 30,
    features: "Darkvision|Hellish Resistance|Infernal Legacy", languages: "Common|Infernal", grantedSpell: "thaumaturgy" },
];

const classRows = [
  { name: "Barbarian", page: 8, hit: 12, saves: "strength|constitution", skillCount: 2,
    skills: "Animal Handling|Athletics|Intimidation|Nature|Perception|Survival", prof: "Light armor|Medium armor|Shields|Simple weapons|Martial weapons",
    fixed: "Explorer's Pack|Javelin*4", equipment: ["primary: Greataxe|Martial Melee Weapon", "secondary: Handaxe*2|Simple Weapon"],
    features: "Rage|Unarmored Defense", resources: [["Rage", 2]] as const, unarmored: "constitution" },
  { name: "Bard", page: 11, hit: 8, saves: "dexterity|charisma", skillCount: 3,
    skills: allSkills, prof: "Light armor|Simple weapons|Hand crossbows|Longswords|Rapiers|Shortswords",
    fixed: "Leather|Dagger", equipment: ["weapon: Rapier|Longsword|Simple Weapon", "pack: Diplomat's Pack|Entertainer's Pack", "instrument: Musical Instrument"],
    features: "Spellcasting|Bardic Inspiration (d6)", choices: ["Instrument proficiencies: Musical Instruments"], resources: [["Bardic Inspiration", "charisma"]] as const,
    casting: { ability: "charisma", cantrips: 2, known: 4, slots: 2 } },
  { name: "Cleric", page: 15, hit: 8, saves: "wisdom|charisma", skillCount: 2,
    skills: "History|Insight|Medicine|Persuasion|Religion", prof: "Light armor|Medium armor|Heavy armor|Shields|Simple weapons",
    fixed: "Shield|Holy Symbol", equipment: ["weapon: Mace|Warhammer", "armor: Scale Mail|Leather|Chain Mail", "ranged: Light Crossbow+Crossbow Bolts*20|Simple Weapon", "pack: Priest's Pack|Explorer's Pack"],
    features: "Spellcasting|Ritual Casting|Life Domain|Disciple of Life",
    casting: { ability: "wisdom", cantrips: 3, slots: 2, prepared: true, granted: ["bless", "cure-wounds"] } },
  { name: "Druid", page: 19, hit: 8, saves: "intelligence|wisdom", skillCount: 2,
    skills: "Arcana|Animal Handling|Insight|Medicine|Nature|Perception|Religion|Survival", prof: "Light armor (nonmetal)|Medium armor (nonmetal)|Shields (nonmetal)|Clubs|Daggers|Darts|Javelins|Maces|Quarterstaffs|Scimitars|Sickles|Slings|Spears|Herbalism kit",
    fixed: "Leather|Explorer's Pack|Druidic Focus", equipment: ["shield-or-weapon: Wooden Shield|Simple Weapon", "weapon: Scimitar|Simple Melee Weapon"],
    features: "Druidic|Spellcasting|Ritual Casting", languages: "Druidic",
    casting: { ability: "wisdom", cantrips: 2, slots: 2, prepared: true } },
  { name: "Fighter", page: 24, hit: 10, saves: "strength|constitution", skillCount: 2,
    skills: "Acrobatics|Animal Handling|Athletics|History|Insight|Intimidation|Perception|Survival", prof: "Light armor|Medium armor|Heavy armor|Shields|Simple weapons|Martial weapons",
    fixed: "", equipment: ["armor: Chain Mail|Leather+Longbow+Arrows*20", "weapon: Martial Weapon+Shield|Martial Weapon+Martial Weapon", "secondary: Light Crossbow+Crossbow Bolts*20|Handaxe*2", "pack: Dungeoneer's Pack|Explorer's Pack"],
    features: "Fighting Style|Second Wind", choices: ["Fighting Style: Archery|Defense|Dueling|Great Weapon Fighting|Protection|Two-Weapon Fighting"], resources: [["Second Wind", 1]] as const },
  { name: "Monk", page: 26, hit: 8, saves: "strength|dexterity", skillCount: 2,
    skills: "Acrobatics|Athletics|History|Insight|Religion|Stealth", prof: "Simple weapons|Shortswords",
    fixed: "Dart*10", equipment: ["weapon: Shortsword|Simple Weapon", "pack: Dungeoneer's Pack|Explorer's Pack"],
    features: "Unarmored Defense|Martial Arts (d4)", choices: ["Monk tool: Artisan’s Tools or Instrument"], unarmored: "wisdom" },
  { name: "Paladin", page: 30, hit: 10, saves: "wisdom|charisma", skillCount: 2,
    skills: "Athletics|Insight|Intimidation|Medicine|Persuasion|Religion", prof: "Light armor|Medium armor|Heavy armor|Shields|Simple weapons|Martial weapons",
    fixed: "Chain Mail|Holy Symbol", equipment: ["weapon: Martial Weapon+Shield|Martial Weapon+Martial Weapon", "secondary: Javelin*5|Simple Melee Weapon", "pack: Priest's Pack|Explorer's Pack"],
    features: "Divine Sense|Lay on Hands", resources: [["Divine Sense", "charisma+1"], ["Lay on Hands", 5]] as const },
  { name: "Ranger", page: 35, hit: 10, saves: "strength|dexterity", skillCount: 3,
    skills: "Animal Handling|Athletics|Insight|Investigation|Nature|Perception|Stealth|Survival", prof: "Light armor|Medium armor|Shields|Simple weapons|Martial weapons",
    fixed: "Longbow|Arrows*20", equipment: ["armor: Scale Mail|Leather", "weapons: Shortsword*2|Simple Melee Weapon+Simple Melee Weapon", "pack: Dungeoneer's Pack|Explorer's Pack"],
    features: "Favored Enemy|Natural Explorer", choices: ["Favored Enemy: Aberrations|Beasts|Celestials|Constructs|Dragons|Elementals|Fey|Fiends|Giants|Monstrosities|Oozes|Plants|Undead|Two Humanoid Races", "Favored Terrain: Arctic|Coast|Desert|Forest|Grassland|Mountain|Swamp|Underdark"] },
  { name: "Rogue", page: 39, hit: 8, saves: "dexterity|intelligence", skillCount: 4,
    skills: "Acrobatics|Athletics|Deception|Insight|Intimidation|Investigation|Perception|Performance|Persuasion|Sleight of Hand|Stealth",
    prof: "Light armor|Simple weapons|Hand crossbows|Longswords|Rapiers|Shortswords|Thieves’ tools",
    fixed: "Leather|Dagger*2|Thieves' Tools", equipment: ["weapon: Rapier|Shortsword", "secondary: Shortbow+Arrows*20|Shortsword", "pack: Burglar's Pack|Dungeoneer's Pack|Explorer's Pack"],
    features: "Expertise|Sneak Attack (1d6)|Thieves’ Cant", languages: "Thieves’ Cant", expertise: 2 },
  { name: "Sorcerer", page: 42, hit: 6, saves: "constitution|charisma", skillCount: 2,
    skills: "Arcana|Deception|Insight|Intimidation|Persuasion|Religion", prof: "Daggers|Darts|Slings|Quarterstaffs|Light crossbows",
    fixed: "Dagger*2", equipment: ["weapon: Light Crossbow+Crossbow Bolts*20|Simple Weapon", "focus: Component Pouch|Arcane Focus", "pack: Dungeoneer's Pack|Explorer's Pack"],
    features: "Spellcasting|Draconic Bloodline|Dragon Ancestor|Draconic Resilience", hpBonus: 1, unarmoredBase: 13, languages: "Draconic",
    choices: ["Dragon Ancestor: Black (acid)|Blue (lightning)|Brass (fire)|Bronze (lightning)|Copper (acid)|Gold (fire)|Green (poison)|Red (fire)|Silver (cold)|White (cold)"],
    casting: { ability: "charisma", cantrips: 4, known: 2, slots: 2 } },
  { name: "Warlock", page: 46, hit: 8, saves: "wisdom|charisma", skillCount: 2,
    skills: "Arcana|Deception|History|Intimidation|Investigation|Nature|Religion", prof: "Light armor|Simple weapons",
    fixed: "Leather|Dagger*2", equipment: ["primary: Light Crossbow+Crossbow Bolts*20|Simple Weapon", "focus: Component Pouch|Arcane Focus", "pack: Scholar's Pack|Dungeoneer's Pack", "secondary: Simple Weapon"],
    features: "Pact Magic|The Fiend|Dark One’s Blessing", casting: { ability: "charisma", cantrips: 2, known: 2, slots: 1, expanded: ["burning-hands", "command"], pact: true } },
  { name: "Wizard", page: 52, hit: 6, saves: "intelligence|wisdom", skillCount: 2,
    skills: "Arcana|History|Insight|Investigation|Medicine|Religion", prof: "Daggers|Darts|Slings|Quarterstaffs|Light crossbows",
    fixed: "Spellbook", equipment: ["weapon: Quarterstaff|Dagger", "focus: Component Pouch|Arcane Focus", "pack: Scholar's Pack|Explorer's Pack"],
    features: "Spellcasting|Ritual Casting|Arcane Recovery", resources: [["Arcane Recovery", 1]] as const,
    casting: { ability: "intelligence", cantrips: 3, spellbook: 6, slots: 2, prepared: true } },
];

const armor = {
  Leather: { base: 11, ability: "dexterity" },
  "Scale Mail": { base: 14, ability: "dexterity", maximumAbilityModifier: 2 },
  "Chain Mail": { base: 16, ability: null, strengthRequirement: 13 },
};
const weaponGroups: Record<string, string[]> = {
  "Simple Melee Weapon": list("Club|Dagger|Greatclub|Handaxe|Javelin|Light Hammer|Mace|Quarterstaff|Sickle|Spear"),
  "Simple Ranged Weapon": list("Light Crossbow|Dart|Shortbow|Sling"),
  "Martial Melee Weapon": list("Battleaxe|Flail|Glaive|Greataxe|Greatsword|Halberd|Lance|Longsword|Maul|Morningstar|Pike|Rapier|Scimitar|Shortsword|Trident|War Pick|Warhammer|Whip"),
  "Martial Ranged Weapon": list("Blowgun|Hand Crossbow|Heavy Crossbow|Longbow|Net"),
};
weaponGroups["Simple Weapon"] = [...weaponGroups["Simple Melee Weapon"]!, ...weaponGroups["Simple Ranged Weapon"]!];
weaponGroups["Martial Weapon"] = [...weaponGroups["Martial Melee Weapon"]!, ...weaponGroups["Martial Ranged Weapon"]!];
weaponGroups["Musical Instrument"] = list("Bagpipes|Drum|Dulcimer|Flute|Lute|Lyre|Horn|Pan Flute|Shawm|Viol");

function columns(page: string): string[][] {
  const left: string[] = [], right: string[] = [];
  for (const line of page.split("\n")) {
    if (words(line).startsWith("Not for resale.")) continue;
    const [first, second] = line.split(/ {35,}/);
    if (words(first ?? "")) left.push(words(first!));
    if (words(second ?? "")) right.push(words(second!));
  }
  return [left, right];
}

function spellLists(pages: readonly string[]) {
  const spells = new Map<string, { name: string; level: number; page: number }>();
  const byClass = new Map<string, string[]>();
  let classKey: string | undefined;
  let level = -1;
  for (let page = 105; page <= 113; page++) {
    for (const line of columns(pages[page - 1]!).flat()) {
      const section = /^(Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Warlock|Wizard) Spells$/.exec(line);
      if (section) {
        classKey = slugHeading(section[1]!); byClass.set(classKey, []); level = -1; continue;
      }
      if (line === "Cantrips (0 Level)") { level = 0; continue; }
      const levelHeading = /^([1-9])(?:st|nd|rd|th) Level$/.exec(line);
      if (levelHeading) { level = Number(levelHeading[1]); continue; }
      if (!classKey || level < 0 || level > 1) continue;
      const key = slugHeading(line);
      byClass.get(classKey)!.push(key);
      spells.set(key, { name: line, level, page });
    }
  }
  if (byClass.size !== 8 || !spells.has("magic-missile") || !spells.has("cure-wounds") || spells.size < 60) {
    throw new Error("SRD_CHARACTER_SPELL_LIST_INCOMPLETE");
  }
  return { spells, byClass };
}

export function extractSrdCharacterOptions(rawText: string) {
  const pages = rawText.split("\f");
  const options: StructuredCharacterOption[] = [];
  const chunks: SourceChunk[] = [];
  const ruleSections: RuleSection[] = [];
  const sections = new Map<string, string>();
  const equipment = new Map<string, string>();
  const source = (heading: string, page: number, end = page, anchor = heading) => {
    const ruleKey = slugHeading(heading);
    const existing = sections.get(ruleKey);
    if (existing) return existing;
    const text = pages.slice(page - 1, end).map((item) => item.replace(/\t\r[ \u00a0]*/g, " ").trim()).join("\n\n");
    if (!words(text).toLowerCase().includes(anchor.toLowerCase())) throw new Error(`SRD_CHARACTER_ANCHOR_MISSING:${heading}`);
    const textSha256 = createHash("sha256").update(text).digest("hex");
    const id = `srd-5.1:${page}:character-${ruleKey}:${textSha256.slice(0, 12)}`;
    const ruleSectionId = `rule:${id}`;
    chunks.push({ id, documentId: "srd-5.1", pageStart: page, pageEnd: end,
      headingPath: [heading], edition: "SRD_5_1", contentKind: "MECHANICS", confidenceStatus: "NATIVE_TEXT", text, textSha256 });
    ruleSections.push({ id: ruleSectionId, chunkId: id, ruleKey: `character-${ruleKey}`, category: "character-creation" });
    sections.set(ruleKey, ruleSectionId);
    return ruleSectionId;
  };
  const add = (optionKind: StructuredCharacterOption["optionKind"], optionKey: string, displayName: string, ruleSectionId: string, optionJson: Record<string, unknown>) =>
    options.push({ optionKind, optionKey, displayName, ruleSectionId, optionJson });
  const item = (description: string) => {
    const [name, quantity] = description.split("*");
    const id = slugId("equipment", name!);
    equipment.set(id, name!);
    return Array.from({ length: Number(quantity ?? 1) }, () => id);
  };
  const group = (text: string) => {
    const separator = text.indexOf(": ");
    const key = slugHeading(text.slice(0, separator));
    const names = list(text.slice(separator + 2));
    return { key, count: 1, choices: names.flatMap((name) => {
      const variants = name.split("+").reduce<string[][]>((sets, part) =>
        sets.flatMap((set) => (weaponGroups[part] ?? [part]).map((choice) => [...set, choice])), [[]]);
      return variants.map((parts) => ({ key: `${key}-${slugHeading(parts.join("-"))}`, displayName: parts.join(" + "), equipmentIds: parts.flatMap(item) }));
    }).filter((choice, index, choices) => choices.findIndex(({ key }) => key === choice.key) === index) };
  };
  const instruments = weaponGroups["Musical Instrument"]!;
  const optionsFor = (values: readonly string[] = []) => values.map((value) => {
    const [label, options] = value.split(": ") as [string, string];
    const isBard = options === "Musical Instruments";
    const choices = isBard ? instruments : options === "Artisan’s Tools or Instrument"
      ? [...list("Alchemist’s Supplies|Brewer’s Supplies|Calligrapher’s Supplies|Carpenter’s Tools|Cartographer’s Tools|Cobbler’s Tools|Cook’s Utensils|Glassblower’s Tools|Jeweler’s Tools|Leatherworker’s Tools|Mason’s Tools|Painter’s Supplies|Potter’s Tools|Smith’s Tools|Tinker’s Tools|Weaver’s Tools|Woodcarver’s Tools"), ...instruments]
      : list(options);
    return { key: slugHeading(label), label, count: isBard ? 3 : 1, options: choices.map((name) => ({ key: slugHeading(name), name })),
      ...(isBard || label.endsWith("tool") ? { proficiency: true } : {}) };
  });
  const resources = (values: readonly (readonly [string, number | string])[] | undefined, ref: string) => (values ?? []).map(([name, maximum]) => ({
    id: slugId("resource", name), name, maximum: typeof maximum === "number" ? maximum : 1,
    ...(typeof maximum === "string" ? { ability: "charisma", extra: maximum.endsWith("+1") ? 1 : 0 } : {}),
    sourceReferenceId: ref,
  }));
  const skillsRef = source("Ability Checks and Skills", 77, 83, "Skills");
  const skills = Object.fromEntries(Object.entries(skillGroups).flatMap(([ability, names]) => list(names).map((displayName) => {
    const key = slugHeading(displayName);
    return [key, { key, displayName, ability, sourceReferenceId: skillsRef }];
  })));
  const { spells, byClass } = spellLists(pages);
  for (const [key, spell] of spells) add("SPELL", key, spell.name, source(`Spell List Page ${spell.page}`, spell.page, spell.page, spell.name),
    { id: slugId("spell", key), level: spell.level });

  for (const row of ancestryRows) {
    const ref = source(row.name, row.page, row.page + 1);
    add("ANCESTRY", slugHeading(row.name), row.name, ref, {
      abilityBonuses: row.bonuses, speed: row.speed, featureSourceReferenceIds: [ref],
      features: row.features ? list(row.features).map((name) => feature(name)) : [],
      hpBonus: row.hpBonus ?? 0, proficiencies: row.proficiencies ? list(row.proficiencies) : [],
      skillProficiencies: row.skills ? keys(row.skills) : [],
      languages: list(row.languages), languageChoices: row.languageChoices ?? 0, skillChoices: row.skillChoices ?? 0,
      abilityChoices: row.abilityChoices ?? 0, optionGroups: optionsFor(row.choices),
      resources: resources(row.resources, ref),
      ...(row.cantripClass ? { cantripOptions: byClass.get(row.cantripClass)!.filter((key) => spells.get(key)!.level === 0) } : {}),
      ...(row.grantedSpell ? { grantedSpells: [row.grantedSpell] } : {}),
    });
  }
  for (const row of classRows) {
    const ref = source(row.name, row.page, row.page + 1);
    const casting = row.casting;
    add("CLASS", slugHeading(row.name), row.name, ref, {
      hitDie: row.hit, savingThrowAbilities: list(row.saves), skillChoice: { count: row.skillCount, options: keys(row.skills) },
      fixedEquipmentIds: row.fixed ? list(row.fixed).flatMap(item) : [],
      equipmentChoiceGroups: row.equipment.map(group),
      unarmoredArmorClass: { base: row.unarmoredBase ?? 10, ability: "dexterity", ...(row.unarmored ? { secondAbility: row.unarmored } : {}) },
      resources: resources(row.resources, ref), proficiencies: list(row.prof),
      features: list(row.features).map((name) => feature(name)), featureSourceReferenceIds: [ref],
      optionGroups: optionsFor(row.choices), expertise: row.expertise ?? 0, hpBonus: row.hpBonus ?? 0,
      languages: row.languages ? list(row.languages) : [],
      spellcasting: casting ? {
        selectionMode: casting.prepared ? "PREPARED" : "KNOWN", choiceCount: casting.known ?? 0,
        availableSpellKeys: [...byClass.get(slugHeading(row.name))!, ...(casting.expanded ?? [])],
        slots: { "1": casting.slots }, ability: casting.ability, cantripCount: casting.cantrips,
        ...(casting.spellbook ? { spellbookCount: casting.spellbook } : {}),
        ...(casting.granted ? { grantedSpellKeys: casting.granted } : {}),
        ...(casting.pact ? { pact: true } : {}),
      } : null,
    });
  }
  const backgroundRef = source("Acolyte", 60, 61);
  add("BACKGROUND", "acolyte", "Acolyte", backgroundRef, {
    skills, skillProficiencies: ["insight", "religion"], equipmentIds: list("Holy Symbol|Prayer Book or Prayer Wheel|Incense Stick*5|Vestments|Common Clothes|Pouch|Gold Piece*15").flatMap(item),
    languageChoices: 2, features: [feature("Shelter of the Faithful")], featureSourceReferenceIds: [backgroundRef],
  });
  for (const [id, name] of equipment) {
    const armorClass = armor[name as keyof typeof armor];
    const shield = name === "Shield" || name === "Wooden Shield";
    const isWeapon = [...weaponGroups["Simple Weapon"]!, ...weaponGroups["Martial Weapon"]!].includes(name);
    const ref = armorClass || shield ? source("Armor and Shields", 62, 64, "Armor")
      : isWeapon ? source("Weapons", 65, 66)
      : name.endsWith("Pack") ? source("Equipment Packs", 70, 70)
      : name === "Gold Piece" ? source("Coinage", 62, 62, "Gold")
      : source("Adventuring Equipment", 67, 71, "Equipment");
    add("EQUIPMENT", id, name, ref, { ...(armorClass ? { armorClass } : {}), ...(shield ? { shieldBonus: 2 } : {}) });
  }
  return { chunks, ruleSections, characterOptions: options };
}
