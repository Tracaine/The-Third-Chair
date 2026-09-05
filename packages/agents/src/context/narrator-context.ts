import { z } from "zod";
import {
  ActorIntentSchema, CheckResolutionSchema, PersistedIdSchema, PlayerActorViewSchema, PlayerSeatSchema,
  PlayerViewSchema, ResolutionCheckSchema, ResolutionPlanSchema, TurnProposalSchema,
  type CheckResolution, type PlayerSeat, type PlayerView, type ResolutionPlan,
  type TurnProposal, type WorldOperation,
} from "@third-chair/contracts";
import {
  checked, ContextBudgetError, ContextDiagnosticSchema, enforceBudgets, exactPersistedSchema, measureTotal, newestSummaries,
  rankedMemories, SelectedMemoriesSchema, SelectedMemorySchema, TurnSummariesSchema, uniqueRecordIds, utf8Bytes, type SelectedMemory, type TurnSummary,
} from "./budget.js";

const NarrationViewSchema = PlayerViewSchema.extend({ actors: z.array(PlayerActorViewSchema.omit({ scopedNotes: true }).strict()) }).strict();
type NarrationView = z.infer<typeof NarrationViewSchema>;
const EventSchema = PlayerViewSchema.shape.events.element;
const ItemSchema = PlayerViewSchema.shape.inventory.element;
const FactSchema = PlayerViewSchema.shape.facts.element;
const Base = z.object({ id: PersistedIdSchema });
const Actor = { actorId: PersistedIdSchema };
const Resource = { ...Actor, resourceId: PersistedIdSchema, current: z.number().int().nonnegative(), amount: z.number().int().positive() };
const SafeOperationSchema = z.discriminatedUnion("kind", [
  Base.extend({ kind: z.literal("SET_HP"), ...Actor, value: z.number().int() }).strict(),
  Base.extend({ kind: z.literal("SET_TEMP_HP"), ...Actor, value: z.number().int().nonnegative() }).strict(),
  Base.extend({ kind: z.literal("SPEND_RESOURCE"), ...Resource }).strict(),
  Base.extend({ kind: z.literal("RESTORE_RESOURCE"), ...Resource }).strict(),
  Base.extend({ kind: z.literal("ADD_CONDITION"), ...Actor, condition: z.string() }).strict(),
  Base.extend({ kind: z.literal("REMOVE_CONDITION"), ...Actor, condition: z.string() }).strict(),
  Base.extend({ kind: z.literal("MOVE_ACTOR"), ...Actor, locationId: PersistedIdSchema }).strict(),
  Base.extend({ kind: z.literal("ADD_INVENTORY"), item: ItemSchema }).strict(),
  Base.extend({ kind: z.literal("REMOVE_INVENTORY"), itemId: PersistedIdSchema }).strict(),
  Base.extend({ kind: z.literal("SET_EQUIPPED"), itemId: PersistedIdSchema, slots: z.array(z.string()) }).strict(),
  Base.extend({ kind: z.literal("ADD_FACT"), fact: FactSchema }).strict(),
  Base.extend({ kind: z.literal("ADD_EVENT"), event: EventSchema }).strict(),
  Base.extend({ kind: z.literal("ADVANCE_CLOCK"), clockId: PersistedIdSchema, current: z.number().int().nonnegative(), maximum: z.number().int().positive() }).strict(),
  Base.extend({ kind: z.literal("SET_NPC_ATTITUDE"), npcId: PersistedIdSchema, status: z.string() }).strict(),
  Base.extend({ kind: z.literal("SET_QUEST_STATUS"), questId: PersistedIdSchema, status: z.string() }).strict(),
  Base.extend({ kind: z.literal("SET_COMBAT"), combat: PlayerViewSchema.shape.combat }).strict(),
  Base.extend({ kind: z.literal("ADVANCE_INITIATIVE"), combat: PlayerViewSchema.shape.combat.unwrap() }).strict(),
  Base.extend({ kind: z.literal("SET_DECISION"), decision: PlayerViewSchema.shape.currentDecision }).strict(),
]);
type SafeOperation = z.infer<typeof SafeOperationSchema>;
const ToneSettingsSchema = z.object({ style: z.string(), pacing: z.string().optional(), contentLimits: z.array(z.string()) }).strict();

export const NarratorInputSchema = z.object({
  viewer: PlayerSeatSchema,
  beforeView: NarrationViewSchema, afterView: NarrationViewSchema,
  lockedIntents: z.array(ActorIntentSchema),
  persistedPlan: exactPersistedSchema(ResolutionPlanSchema.extend({ checks: z.array(ResolutionCheckSchema.extend({ visibility: z.literal("PUBLIC") })).min(1).max(20) }).nullable()),
  persistedResolutions: exactPersistedSchema(z.array(CheckResolutionSchema.extend({ visibility: z.literal("PUBLIC") }))),
  visibleOperations: z.array(SafeOperationSchema), visibleEvents: z.array(EventSchema),
  toneSettings: ToneSettingsSchema, narrativeBrief: TurnProposalSchema.shape.narrativeBrief,
  recentTurnSummaries: TurnSummariesSchema.max(12),
  selectedMemories: z.array(SelectedMemorySchema.extend({ audience: z.enum(["PUBLIC", "PARTY"]) })).refine(uniqueRecordIds, "Duplicate memory IDs"),
  diagnostic: ContextDiagnosticSchema,
}).strict().refine((input) => utf8Bytes(input) <= 32_000, "narratorInput exceeds byte budget");
export type NarratorInput = z.infer<typeof NarratorInputSchema>;
export interface NarratorBuildInput {
  viewer?: PlayerSeat;
  beforeView: PlayerView;
  afterView: PlayerView;
  lockedIntents: readonly z.input<typeof ActorIntentSchema>[];
  persistedPlan?: ResolutionPlan | null;
  persistedResolutions: readonly CheckResolution[];
  visibleOperations: readonly WorldOperation[];
  visibleEvents: readonly { id: string }[];
  toneSettings: z.infer<typeof ToneSettingsSchema>;
  narrativeBrief: TurnProposal["narrativeBrief"];
  recentTurnSummaries?: readonly TurnSummary[];
  selectedMemories?: readonly SelectedMemory[];
}

function narrationView(view: PlayerView, field: string): NarrationView {
  return checked(field, NarrationViewSchema, {
    ...view, actors: view.actors.map(({ scopedNotes: _privateMemories, ...actor }) => actor),
  }, 32_000);
}

/** Only read IDs from operations. Resolved values come from trusted player projections. */
function projectOperation(op: WorldOperation, before: NarrationView, after: NarrationView): SafeOperation | null {
  const base = { id: op.id, kind: op.kind };
  const priorActor = "actorId" in op ? before.actors.find(({ id }) => id === op.actorId) : undefined;
  const actor = "actorId" in op ? after.actors.find(({ id }) => id === op.actorId) : undefined;
  switch (op.kind) {
    case "SET_HP": return actor ? { ...base, kind: op.kind, actorId: actor.id, value: actor.currentHp } : null;
    case "SET_TEMP_HP": return actor ? { ...base, kind: op.kind, actorId: actor.id, value: actor.temporaryHp } : null;
    case "SPEND_RESOURCE": case "RESTORE_RESOURCE": {
      const prior = priorActor?.resources?.find(({ id }) => id === op.resourceId);
      const current = actor?.resources?.find(({ id }) => id === op.resourceId);
      if (!prior || !current || !actor) return null;
      const amount = op.kind === "SPEND_RESOURCE" ? prior.current - current.current : current.current - prior.current;
      return amount > 0 ? { ...base, kind: op.kind, actorId: actor.id, resourceId: current.id, current: current.current, amount } : null;
    }
    case "ADD_CONDITION": return actor?.conditions.includes(op.condition)
      ? { ...base, kind: op.kind, actorId: actor.id, condition: op.condition } : null;
    case "REMOVE_CONDITION": return priorActor?.conditions.includes(op.condition) && actor && !actor.conditions.includes(op.condition)
      ? { ...base, kind: op.kind, actorId: actor.id, condition: op.condition } : null;
    case "MOVE_ACTOR": return actor && after.location.id === op.locationId
      ? { ...base, kind: op.kind, actorId: actor.id, locationId: after.location.id } : null;
    case "ADD_INVENTORY": {
      const item = after.inventory.find(({ id }) => id === op.item.id);
      return item ? { ...base, kind: op.kind, item } : null;
    }
    case "REMOVE_INVENTORY": return before.inventory.some(({ id }) => id === op.itemId) && !after.inventory.some(({ id }) => id === op.itemId)
      ? { ...base, kind: op.kind, itemId: op.itemId } : null;
    case "SET_EQUIPPED": {
      const item = after.inventory.find(({ id }) => id === op.itemId);
      return item ? { ...base, kind: op.kind, itemId: item.id, slots: item.equippedSlots } : null;
    }
    case "ADD_FACT": {
      const fact = after.facts.find(({ id }) => id === op.fact.id);
      return fact ? { ...base, kind: op.kind, fact } : null;
    }
    case "ADD_EVENT": {
      const event = after.events.find(({ id }) => id === op.event.id);
      return event ? { ...base, kind: op.kind, event } : null;
    }
    case "ADVANCE_CLOCK": {
      const clock = after.clocks.find(({ id }) => id === op.clockId);
      return clock ? { ...base, kind: op.kind, clockId: clock.id, current: clock.current, maximum: clock.maximum } : null;
    }
    case "SET_NPC_ATTITUDE": {
      const npc = after.npcs.find(({ id }) => id === op.npcId);
      return npc ? { ...base, kind: op.kind, npcId: npc.id, status: npc.status } : null;
    }
    case "SET_QUEST_STATUS": {
      const quest = after.openThreads.find(({ id }) => id === op.questId);
      return quest ? { ...base, kind: op.kind, questId: quest.id, status: quest.status } : null;
    }
    case "SET_COMBAT": {
      if (op.combat === null) return before.combat && after.combat === null ? { ...base, kind: op.kind, combat: null } : null;
      if (typeof op.combat !== "object" || !("id" in op.combat) || op.combat.id !== after.combat?.id) return null;
      return { ...base, kind: op.kind, combat: after.combat };
    }
    case "ADVANCE_INITIATIVE": return after.combat ? { ...base, kind: op.kind, combat: after.combat } : null;
    case "SET_DECISION": return op.decision !== null && typeof op.decision === "object" && "id" in op.decision && op.decision.id === after.currentDecision.id
      ? { ...base, kind: op.kind, decision: after.currentDecision } : null;
    // Flags have no player projection. Future/unknown operation variants fail closed.
    default: return null;
  }
}

export function buildNarratorInput(args: NarratorBuildInput): NarratorInput {
  const viewer = checked("viewer", PlayerSeatSchema, args.viewer ?? "RAVEN", 32_000);
  const beforeView = narrationView(args.beforeView, "beforeView");
  const afterView = narrationView(args.afterView, "afterView");
  const knownActorIds = new Set([...beforeView.actors, ...afterView.actors, ...beforeView.npcs, ...afterView.npcs].map(({ id }) => id));
  const lockedIntents = checked("lockedIntents", z.array(ActorIntentSchema), args.lockedIntents, 32_000);
  const plan = checked("persistedPlan", exactPersistedSchema(ResolutionPlanSchema.nullable()), args.persistedPlan ?? null, 32_000);
  const checks = plan?.checks.filter((check) => check.visibility === "PUBLIC" && knownActorIds.has(check.actorId)) ?? [];
  const persistedPlan = plan && checks.length ? { ...plan, checks } : null;
  const persistedResolutions = checked("persistedResolutions", exactPersistedSchema(z.array(CheckResolutionSchema)), args.persistedResolutions, 32_000)
    .filter((resolution) => resolution.visibility === "PUBLIC" && knownActorIds.has(resolution.actorId));
  const toneSettings = checked("toneSettings", ToneSettingsSchema, args.toneSettings, 32_000);
  const narrativeBrief = checked("narrativeBrief", TurnProposalSchema.shape.narrativeBrief, args.narrativeBrief, 32_000);
  const visibleOperations = args.visibleOperations
    .filter((op) => op.audience === "PUBLIC" || op.audience === "PARTY" || op.audience === viewer)
    .map((op) => projectOperation(op, beforeView, afterView)).filter((op): op is SafeOperation => op !== null);
  const requestedEvents = new Set([...args.visibleEvents.map(({ id }) => id), ...narrativeBrief.requiredEventIds]);
  const visibleEvents = [...beforeView.events.filter(({ id }) => !afterView.events.some((event) => event.id === id)), ...afterView.events]
    .filter(({ id }) => requestedEvents.has(id));
  const missingResolutions = narrativeBrief.requiredResolutionIds.filter((id) => !persistedResolutions.some((resolution) => resolution.id === id));
  const missingEvents = narrativeBrief.requiredEventIds.filter((id) => !visibleEvents.some((event) => event.id === id));
  if (missingResolutions.length || missingEvents.length) throw new ContextBudgetError([
    ...(missingResolutions.length ? [{ field: "narrativeBrief.requiredResolutionIds", actualBytes: utf8Bytes(narrativeBrief.requiredResolutionIds), maximumBytes: 32_000, issueCount: missingResolutions.length }] : []),
    ...(missingEvents.length ? [{ field: "narrativeBrief.requiredEventIds", actualBytes: utf8Bytes(narrativeBrief.requiredEventIds), maximumBytes: 32_000, issueCount: missingEvents.length }] : []),
  ]);
  const summaries = checked("recentTurnSummaries", TurnSummariesSchema, args.recentTurnSummaries ?? [], 32_000);
  const recentTurnSummaries = newestSummaries(summaries);
  const knownIds = new Set([beforeView.location.id, afterView.location.id, ...knownActorIds,
    ...[beforeView, afterView].flatMap((view) => [...view.inventory, ...view.factions, ...view.openThreads, ...view.clocks, ...view.facts, ...view.events].map(({ id }) => id))]);
  const selectedMemories = rankedMemories(checked("selectedMemories", SelectedMemoriesSchema, args.selectedMemories ?? [], 32_000)
    .filter((memory) => (memory.audience === "PUBLIC" || memory.audience === "PARTY") && memory.relatedEntityIds.some((id) => knownIds.has(id)))
    .map((memory) => ({ ...memory, relatedEntityIds: memory.relatedEntityIds.filter((id) => knownIds.has(id)) })));
  const diagnostic = { bytes: {} as Record<string, number>, dropped: { turnSummaries: summaries.length - recentTurnSummaries.length, memories: 0 } };
  const output = { viewer, beforeView, afterView, lockedIntents, persistedPlan, persistedResolutions,
    visibleOperations, visibleEvents, toneSettings, narrativeBrief, recentTurnSummaries, selectedMemories, diagnostic };
  const measure = () => {
    diagnostic.bytes = {
      beforeView: utf8Bytes(beforeView), afterView: utf8Bytes(afterView), lockedIntents: utf8Bytes(lockedIntents),
      persistedPlan: utf8Bytes(persistedPlan), persistedResolutions: utf8Bytes(persistedResolutions),
      visibleOperations: utf8Bytes(visibleOperations), visibleEvents: utf8Bytes(visibleEvents), toneSettings: utf8Bytes(toneSettings),
      narrativeBrief: utf8Bytes(narrativeBrief), recentTurnSummaries: utf8Bytes(recentTurnSummaries), selectedMemories: utf8Bytes(selectedMemories),
    };
    return measureTotal(output, "narratorInput");
  };
  while (measure() > 32_000 && recentTurnSummaries.length) { recentTurnSummaries.shift(); diagnostic.dropped.turnSummaries++; }
  while (measure() > 32_000 && selectedMemories.length) { selectedMemories.pop(); diagnostic.dropped.memories++; }
  enforceBudgets([{ field: "narratorInput", value: output, maximumBytes: 32_000 }]);
  return checked("narratorInput", NarratorInputSchema, output, 32_000);
}
