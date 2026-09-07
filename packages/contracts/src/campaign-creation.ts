import { z } from "zod";
import { CharacterDraftSchema } from "./characters.js";
import { DecisionRequestSchema } from "./decisions.js";
import { AudienceSchema, PersistedIdSchema, PlayerSeatSchema } from "./ids.js";
import { SourceCitationSchema } from "./sources.js";

const NameSchema = z.string().trim().min(1).max(200);
const TextSchema = z.string().trim().min(1).max(2_000);
const KeySchema = z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9_-]*$/);
const SourceHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const CampaignSettingSchema = z.object({
  region: z.literal("Dalelands"),
  startDateDr: z.literal(1375),
}).strict();

export const CampaignCreationRequestSchema = z.object({
  requestId: PersistedIdSchema,
  ownerId: z.string().trim().min(1).max(200),
  campaignName: NameSchema,
  tone: z.string().trim().max(500).optional(),
  boundaries: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  sourcePackHash: SourceHashSchema,
  setting: CampaignSettingSchema,
  creationMode: z.enum(["ADVANCED", "QUICKSTART"]).default("ADVANCED"),
  billCharacter: CharacterDraftSchema.optional(),
  ravenCharacter: CharacterDraftSchema.optional(),
}).strict();

export const QuickstartArchetypeSchema = z.enum([
  "STALWART_FIGHTER",
  "CUNNING_ROGUE",
  "ARCANE_SCHOLAR",
  "DAWN_CLERIC",
]);

export const QuickstartCharacterChoiceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  pronouns: z.string().trim().max(80).default(""),
  archetype: QuickstartArchetypeSchema,
  characterHook: z.string().trim().max(500).default(""),
}).strict();

export const QuickstartCampaignSchema = z.object({
  billCharacter: QuickstartCharacterChoiceSchema,
  ravenCharacter: QuickstartCharacterChoiceSchema,
}).strict();

export const CampaignRecordOriginSchema = z.enum(["AUTHORED_SETTING", "CAMPAIGN_GENERATED"]);
const SourcedRecordFields = {
  audience: AudienceSchema,
  origin: CampaignRecordOriginSchema,
  citationIds: z.array(z.string().trim().min(1).max(300)).max(12),
};
const CampaignFactSchema = z.object({ text: TextSchema, ...SourcedRecordFields }).strict();

const RouteMethodSchema = z.enum([
  "SOCIAL_LEVERAGE",
  "INVESTIGATION_DISCOVERY",
  "FACTION_OR_TRAVEL",
]);

const RouteSchema = z.object({
  key: KeySchema,
  method: RouteMethodSchema,
  premise: CampaignFactSchema,
  startingClueKeys: z.array(KeySchema).min(1).max(6),
}).strict();

const CampaignCitationSchema = SourceCitationSchema.extend({ id: z.string().trim().min(1).max(300) }).strict();

export const CampaignSpineProposalSchema = z.object({
  setting: CampaignSettingSchema,
  opening: z.object({
    locationKey: KeySchema,
    locationName: NameSchema,
    location: CampaignFactSchema,
    pressure: CampaignFactSchema,
  }).strict(),
  centralTruth: CampaignFactSchema,
  routes: z.array(RouteSchema).length(3),
  factions: z.array(z.object({
    key: KeySchema,
    name: NameSchema,
    goal: CampaignFactSchema,
    clock: z.object({
      key: KeySchema,
      name: NameSchema,
      ...SourcedRecordFields,
      current: z.literal(0),
      segments: z.literal(6),
    }).strict(),
  }).strict()).min(1).max(12),
  npcs: z.array(z.object({
    key: KeySchema,
    name: NameSchema,
    ...SourcedRecordFields,
    intention: TextSchema,
    relationships: z.array(TextSchema).min(1).max(12),
    contradiction: TextSchema,
  }).strict()).min(1).max(20),
  outcomes: z.array(z.object({ key: KeySchema, text: TextSchema, ...SourcedRecordFields }).strict()).min(2).max(8),
  startingClues: z.array(z.object({ key: KeySchema, text: TextSchema, ...SourcedRecordFields }).strict()).min(1).max(18),
  riskTags: z.array(z.object({ key: KeySchema, text: TextSchema, ...SourcedRecordFields }).strict()).min(1).max(18),
  citations: z.array(CampaignCitationSchema).max(24),
}).strict().superRefine((spine, context) => {
  const requiredMethods = new Set(RouteMethodSchema.options);
  const methods = new Set(spine.routes.map((route) => route.method));
  if (methods.size !== 3 || [...requiredMethods].some((method) => !methods.has(method))) {
    context.addIssue({ code: "custom", path: ["routes"], message: "CAMPAIGN_ROUTE_METHODS_INVALID" });
  }
  const routeKeys = new Set(spine.routes.map((route) => route.key));
  if (routeKeys.size !== spine.routes.length) {
    context.addIssue({ code: "custom", path: ["routes"], message: "CAMPAIGN_ROUTES_EQUIVALENT" });
  }
  const clueSets = spine.routes.map((route) => [...new Set(route.startingClueKeys)].sort().join("\u0000"));
  if (new Set(clueSets).size !== clueSets.length) {
    context.addIssue({ code: "custom", path: ["routes"], message: "CAMPAIGN_ROUTES_EQUIVALENT" });
  }
  const citationIds = new Set(spine.citations.map((citation) => citation.id));
  if (citationIds.size !== spine.citations.length) {
    context.addIssue({ code: "custom", path: ["citations"], message: "DUPLICATE_CAMPAIGN_CITATION" });
  }
  const sourced: Array<{ origin: string; citationIds: string[] }> = [
    spine.opening.location, spine.opening.pressure, spine.centralTruth,
    ...spine.routes.map((route) => route.premise),
    ...spine.factions.flatMap((faction) => [faction.goal, faction.clock]),
    ...spine.npcs, ...spine.outcomes, ...spine.startingClues, ...spine.riskTags,
  ];
  for (const [index, record] of sourced.entries()) {
    if (record.origin === "AUTHORED_SETTING" && record.citationIds.length === 0) {
      context.addIssue({ code: "custom", path: ["records", index], message: "AUTHORED_SETTING_CITATION_REQUIRED" });
    }
    if (record.citationIds.some((id) => !citationIds.has(id))) {
      context.addIssue({ code: "custom", path: ["records", index], message: "UNKNOWN_CAMPAIGN_CITATION" });
    }
  }
  if (spine.centralTruth.audience !== "DIRECTOR"
    || spine.routes.some((route) => route.premise.audience !== "DIRECTOR")
    || spine.factions.some((faction) => faction.goal.audience !== "DIRECTOR" || faction.clock.audience !== "DIRECTOR")
    || spine.npcs.some((npc) => npc.audience !== "DIRECTOR")
    || spine.outcomes.some((outcome) => outcome.audience !== "DIRECTOR")
    || spine.riskTags.some((risk) => risk.audience !== "DIRECTOR")) {
    context.addIssue({ code: "custom", path: ["audience"], message: "HIDDEN_CAMPAIGN_RECORD_AUDIENCE_REQUIRED" });
  }
  const playerVisible = new Set(["PUBLIC", "PARTY"]);
  if (!playerVisible.has(spine.opening.location.audience)
    || !playerVisible.has(spine.opening.pressure.audience)
    || spine.startingClues.some((clue) => !playerVisible.has(clue.audience))) {
    context.addIssue({ code: "custom", path: ["audience"], message: "VISIBLE_OPENING_AUDIENCE_REQUIRED" });
  }
  const clueKeys = new Set(spine.startingClues.map((clue) => clue.key));
  if (spine.routes.some((route) => route.startingClueKeys.some((key) => !clueKeys.has(key)))) {
    context.addIssue({ code: "custom", path: ["routes"], message: "UNKNOWN_STARTING_CLUE" });
  }
});

export const CampaignSpineInputSchema = z.object({
  requestId: PersistedIdSchema,
  campaignName: NameSchema,
  tone: z.string().trim().max(500).optional(),
  boundaries: z.array(z.string().trim().min(1).max(500)).max(30),
  sourcePackHash: SourceHashSchema,
  setting: CampaignSettingSchema,
  characters: z.array(z.object({
    controller: PlayerSeatSchema,
    name: NameSchema,
    classSourceKey: NameSchema,
    ancestrySourceKey: NameSchema,
    backgroundSourceKey: NameSchema,
    characterHook: z.string().trim().max(500),
  }).strict()).length(2),
}).strict();

export const PublicCharacterCardSchema = z.object({
  actorId: PersistedIdSchema,
  controller: PlayerSeatSchema,
  name: NameSchema,
  pronouns: z.string().trim().max(80),
  level: z.literal(1),
  ancestrySourceKey: NameSchema,
  classSourceKey: NameSchema,
  backgroundSourceKey: NameSchema,
  abilities: z.object({
    strength: z.number().int(), dexterity: z.number().int(), constitution: z.number().int(),
    intelligence: z.number().int(), wisdom: z.number().int(), charisma: z.number().int(),
  }).strict(),
  proficiencyBonus: z.number().int(),
  armorClass: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  speed: z.number().int().nonnegative(),
}).strict();

export const CreateCampaignOutputSchema = z.object({
  campaignId: PersistedIdSchema,
  sourcePackHash: SourceHashSchema,
  visibleOpening: TextSchema,
  characters: z.array(PublicCharacterCardSchema).length(2),
  currentDecision: DecisionRequestSchema,
  playerViewId: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type CampaignCreationRequest = z.infer<typeof CampaignCreationRequestSchema>;
export type QuickstartArchetype = z.infer<typeof QuickstartArchetypeSchema>;
export type QuickstartCharacterChoice = z.infer<typeof QuickstartCharacterChoiceSchema>;
export type CampaignSpineProposal = z.infer<typeof CampaignSpineProposalSchema>;
export type CampaignSpineInput = z.infer<typeof CampaignSpineInputSchema>;
export type PublicCharacterCard = z.infer<typeof PublicCharacterCardSchema>;
export type CreateCampaignOutput = z.infer<typeof CreateCampaignOutputSchema>;
