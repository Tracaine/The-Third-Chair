import { z } from "zod";
import {
  ActorIntentSchema, ActorStateSchema, AudienceSchema, CheckResolutionSchema, ClockStateSchema,
  DecisionRequestSchema, FactionStateSchema, InventoryItemSchema, LocationStateSchema,
  NpcStateSchema, QuestStateSchema, ResolutionPlanSchema, ScopedEventSchema, ScopedFactSchema,
  ScopedFlagSchema, SourceCitationSchema, WorldStateSchema,
  type CheckResolution, type ResolutionPlan, type WorldState,
} from "@third-chair/contracts";
import {
  checked, ContextDiagnosticSchema, enforceBudgets, exactPersistedSchema, measureTotal, newestSummaries, rankedMemories,
  SelectedMemoriesSchema, TurnSummariesSchema, utf8Bytes, type SelectedMemory, type TurnSummary,
} from "./budget.js";
import { serializeSourceRecords } from "./serialize.js";
export { ContextBudgetError } from "./budget.js";

const HiddenSpineSchema = z.object({ id: z.string(), audience: AudienceSchema, text: z.string(), relatedEntityIds: z.array(z.string()) }).strict();
const CanonSchema = z.object({ id: z.string(), summary: z.string(), citations: z.array(SourceCitationSchema.strict()) }).strict();
const TableRulingSchema = WorldStateSchema.shape.table.shape.houseRules.element;
const StateSliceSchema = z.object({
  metadata: WorldStateSchema.shape.metadata,
  location: LocationStateSchema,
  actors: z.array(ActorStateSchema.extend({ id: z.string() }).strict()),
  inventory: z.array(InventoryItemSchema), combat: WorldStateSchema.shape.combat,
  npcs: z.array(NpcStateSchema), factions: z.array(FactionStateSchema), quests: z.array(QuestStateSchema), clocks: z.array(ClockStateSchema),
  facts: z.array(ScopedFactSchema), events: z.array(ScopedEventSchema), flags: z.array(ScopedFlagSchema),
  tableSettings: WorldStateSchema.shape.table.omit({ houseRules: true }),
}).strict();

export const DirectorInputSchema = z.object({
  currentDecision: DecisionRequestSchema,
  lockedIntents: z.array(ActorIntentSchema),
  state: StateSliceSchema,
  hiddenSpine: z.array(HiddenSpineSchema),
  recentTurnSummaries: TurnSummariesSchema.max(12),
  selectedMemories: SelectedMemoriesSchema,
  tableRulings: z.array(TableRulingSchema),
  preloadedCanon: z.string(),
  persistedPlan: exactPersistedSchema(ResolutionPlanSchema.nullable()),
  persistedResolutions: exactPersistedSchema(z.array(CheckResolutionSchema)),
  diagnostic: ContextDiagnosticSchema,
}).strict()
  .refine((input) => utf8Bytes({ currentDecision: input.currentDecision, lockedIntents: input.lockedIntents }) <= 8_000, "currentDecisionAndLockedIntents exceeds byte budget")
  .refine((input) => utf8Bytes({ state: input.state, hiddenSpine: input.hiddenSpine }) <= 32_000, "stateAndHiddenSpine exceeds byte budget")
  .refine((input) => utf8Bytes(input.recentTurnSummaries) <= 12_000, "recentTurnSummaries exceeds byte budget")
  .refine((input) => utf8Bytes({ selectedMemories: input.selectedMemories, tableRulings: input.tableRulings }) <= 8_000, "memoriesAndTableRulings exceeds byte budget")
  .refine((input) => utf8Bytes(input.preloadedCanon) <= 8_000, "preloadedCanon exceeds byte budget")
  .refine((input) => utf8Bytes(input) <= 68_000, "directorInput exceeds byte budget");
export type DirectorInput = z.infer<typeof DirectorInputSchema>;

export interface DirectorSelection {
  relatedNpcIds?: readonly string[];
  relatedFactionIds?: readonly string[];
  activeQuestIds?: readonly string[];
  relevantClockIds?: readonly string[];
  relevantFactIds?: readonly string[];
  relevantEventIds?: readonly string[];
  relevantFlagIds?: readonly string[];
  relationships?: readonly { fromId: string; toId: string }[];
}
export interface DirectorBuildInput {
  worldState: WorldState;
  lockedIntents: readonly z.input<typeof ActorIntentSchema>[];
  selection?: DirectorSelection;
  hiddenSpine?: readonly z.infer<typeof HiddenSpineSchema>[];
  recentTurnSummaries?: readonly TurnSummary[];
  selectedMemories?: readonly SelectedMemory[];
  tableRulings?: readonly z.infer<typeof TableRulingSchema>[];
  preloadedCanon?: readonly z.infer<typeof CanonSchema>[];
  persistedPlan?: ResolutionPlan | null;
  persistedResolutions?: readonly CheckResolution[];
}

export function buildDirectorInput(args: DirectorBuildInput): DirectorInput {
  const world = args.worldState;
  const currentDecision = checked("currentDecision", DecisionRequestSchema, world.currentDecision, 8_000);
  const lockedIntents = checked("lockedIntents", z.array(ActorIntentSchema), args.lockedIntents, 8_000);
  const persistedPlan = checked("persistedPlan", exactPersistedSchema(ResolutionPlanSchema.nullable()), args.persistedPlan ?? null, 68_000);
  const persistedResolutions = checked("persistedResolutions", exactPersistedSchema(z.array(CheckResolutionSchema)), args.persistedResolutions ?? [], 68_000);
  const selection = args.selection ?? {};
  const seeds = new Set([world.metadata.currentLocationId, ...currentDecision.eligibleActorIds,
    ...lockedIntents.flatMap((intent) => [intent.actorId, ...intent.targetIds])]);
  // Expand exactly once from decision seeds; explicit additions do not recursively fan out.
  const related = new Set([...seeds, ...(selection.relatedNpcIds ?? []), ...(selection.relatedFactionIds ?? [])]);
  for (const edge of selection.relationships ?? []) {
    if (seeds.has(edge.fromId)) related.add(edge.toId);
    if (seeds.has(edge.toId)) related.add(edge.fromId);
  }
  const selected = new Set([...related, ...(selection.activeQuestIds ?? []), ...(selection.relevantClockIds ?? [])]);
  const pick = <T extends { id: string }>(records: Record<string, T>, ids: ReadonlySet<string>): T[] =>
    Object.keys(records).sort().filter((id) => ids.has(id)).map((id) => records[id]!);
  const actorIds = new Set(Object.keys(world.actors).filter((id) => seeds.has(id)));
  const inventory = Object.keys(world.inventory).sort().map((id) => world.inventory[id]!)
    .filter((item) => seeds.has(item.id) || (item.ownerActorId !== null && actorIds.has(item.ownerActorId)));
  const { houseRules, ...tableSettings } = world.table;
  const state = checked("state", StateSliceSchema, {
    metadata: world.metadata, tableSettings,
    location: world.locations[world.metadata.currentLocationId],
    actors: [...actorIds].sort().map((id) => ({ id, ...world.actors[id]! })), inventory,
    combat: world.combat && world.combat.initiativeOrder.some((id) => seeds.has(id)) ? world.combat : null,
    npcs: pick(world.npcs, related), factions: pick(world.factions, related),
    quests: pick(world.quests, new Set([...seeds, ...(selection.activeQuestIds ?? [])])),
    clocks: pick(world.clocks, new Set([...seeds, ...(selection.relevantClockIds ?? [])])),
    facts: world.facts.filter(({ id }) => selection.relevantFactIds?.includes(id)),
    events: world.events.filter(({ id }) => selection.relevantEventIds?.includes(id)),
    flags: world.flags.filter(({ id }) => selection.relevantFlagIds?.includes(id)),
  }, 32_000);
  const hiddenSpine = checked("hiddenSpine", z.array(HiddenSpineSchema),
    (args.hiddenSpine ?? []).filter((record) => record.relatedEntityIds.some((id) => selected.has(id))), 32_000);
  const tableRulings = checked("tableRulings", z.array(TableRulingSchema), [...houseRules, ...(args.tableRulings ?? [])], 8_000);
  const canon = checked("preloadedCanon", z.array(CanonSchema), args.preloadedCanon ?? [], 8_000);
  const preloadedCanon = serializeSourceRecords(canon);
  const summaries = checked("recentTurnSummaries", TurnSummariesSchema, args.recentTurnSummaries ?? [], 12_000);
  const memories = checked("selectedMemories", SelectedMemoriesSchema, args.selectedMemories ?? [], 8_000)
    .filter((record) => record.relatedEntityIds.some((id) => selected.has(id)));
  const recentTurnSummaries = newestSummaries(summaries);
  const selectedMemories = rankedMemories(memories);
  const diagnostic = { bytes: {} as Record<string, number>, dropped: { turnSummaries: summaries.length - recentTurnSummaries.length, memories: 0 } };
  const decisionData = { currentDecision, lockedIntents };
  const stateData = { state, hiddenSpine };
  enforceBudgets([
    { field: "currentDecisionAndLockedIntents", value: decisionData, maximumBytes: 8_000 },
    { field: "stateAndHiddenSpine", value: stateData, maximumBytes: 32_000 },
    { field: "memoriesAndTableRulings", value: { selectedMemories: [], tableRulings }, maximumBytes: 8_000 },
    { field: "preloadedCanon", value: preloadedCanon, maximumBytes: 8_000 },
  ]);
  while (utf8Bytes(recentTurnSummaries) > 12_000 && recentTurnSummaries.length) { recentTurnSummaries.shift(); diagnostic.dropped.turnSummaries++; }
  while (utf8Bytes({ selectedMemories, tableRulings }) > 8_000 && selectedMemories.length) { selectedMemories.pop(); diagnostic.dropped.memories++; }
  const output = { currentDecision, lockedIntents, state, hiddenSpine, recentTurnSummaries, selectedMemories, tableRulings,
    preloadedCanon, persistedPlan, persistedResolutions, diagnostic };
  const measure = () => {
    diagnostic.bytes = {
      currentDecisionAndLockedIntents: utf8Bytes(decisionData), stateAndHiddenSpine: utf8Bytes(stateData),
      recentTurnSummaries: utf8Bytes(recentTurnSummaries), memoriesAndTableRulings: utf8Bytes({ selectedMemories, tableRulings }),
      preloadedCanon: utf8Bytes(preloadedCanon), persistedPlan: utf8Bytes(persistedPlan), persistedResolutions: utf8Bytes(persistedResolutions),
    };
    return measureTotal(output, "directorInput");
  };
  while (measure() > 68_000 && recentTurnSummaries.length) { recentTurnSummaries.shift(); diagnostic.dropped.turnSummaries++; }
  while (measure() > 68_000 && selectedMemories.length) { selectedMemories.pop(); diagnostic.dropped.memories++; }
  enforceBudgets([{ field: "directorInput", value: output, maximumBytes: 68_000 }]);
  return checked("directorInput", DirectorInputSchema, output, 68_000);
}
