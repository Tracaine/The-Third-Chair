import {
  PlayerJournalSchema,
  VisibleTurnSummarySchema,
  type PlayerJournal,
  type PlayerView,
  type VisibleTurnSummary,
} from "@third-chair/contracts";
import { assertNoForbiddenSentinels } from "../projection/player-view.js";

const JOURNAL_SENTINELS = ["DIRECTOR_SECRET_SENTINEL", "HIDDEN_SENTINEL", "RAVEN_ONLY_SENTINEL"] as const;

function byId<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}

function objectivePriority(status: string): number {
  const normalized = status.toUpperCase();
  if (normalized.includes("URGENT")) return 0;
  if (normalized.includes("ACTIVE")) return 1;
  if (normalized.includes("OPEN")) return 2;
  return 3;
}

function recentTurns(records: readonly VisibleTurnSummary[]): VisibleTurnSummary[] {
  return records
    .map((record) => VisibleTurnSummarySchema.parse({ ...record, narrationExcerpt: record.narrationExcerpt.slice(0, 240) }))
    .sort((left, right) => right.stateVersion - left.stateVersion || left.turnId.localeCompare(right.turnId))
    .slice(0, 20);
}

function collectClues(view: PlayerView) {
  const pools = [view.location.facts, view.facts, ...view.npcs.map(({ facts }) => facts),
    ...view.factions.map(({ facts }) => facts), ...view.openThreads.map(({ facts }) => facts)];
  const found = new Map<string, (typeof view.facts)[number]>();
  for (const fact of pools.flat()) {
    if (fact.kind.toLowerCase().includes("clue")) found.set(fact.id, fact);
  }
  return [...found.values()].sort(byId);
}

export function buildPlayerJournal(
  view: PlayerView,
  visibleTurns: readonly VisibleTurnSummary[],
): PlayerJournal {
  if (view.audience === "PARTY") throw new Error("PLAYER_JOURNAL_REQUIRES_PLAYER_AUDIENCE");
  const currentObjective = [...view.openThreads]
    .sort((left, right) => objectivePriority(left.status) - objectivePriority(right.status) || byId(left, right))[0] ?? null;
  const journal = PlayerJournalSchema.parse({
    campaignId: view.campaignId,
    stateVersion: view.stateVersion,
    audience: view.audience,
    worldDate: view.worldDate,
    location: { id: view.location.id, name: view.location.name, status: view.location.status },
    currentObjective,
    immediateRisk: view.currentDecision.constraints?.trim() || null,
    knownNpcs: [...view.npcs].sort(byId),
    knownClues: collectClues(view),
    inventory: [...view.inventory].sort(byId).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      currency: item.facts.some(({ kind }) => kind.toLowerCase().includes("currency"))
        || /\b(?:copper|silver|electrum|gold|platinum)\b/i.test(item.name),
    })),
    actorStatus: [...view.actors].sort(byId).map((actor) => ({
      id: actor.id, name: actor.name, controller: actor.controller, level: actor.level,
      experiencePoints: actor.experiencePoints, currentHp: actor.currentHp, maxHp: actor.maxHp,
      temporaryHp: actor.temporaryHp, conditions: [...actor.conditions].sort(),
      resources: [...(actor.resources ?? [])].sort(byId),
    })),
    openThreads: [...view.openThreads].sort((left, right) => objectivePriority(left.status) - objectivePriority(right.status) || byId(left, right)),
    acceptedRulings: [...view.acceptedRulings].sort((left, right) => left.acceptedAtTurn - right.acceptedAtTurn || byId(left, right)),
    recentTurns: recentTurns(visibleTurns),
  });
  assertNoForbiddenSentinels(journal, JOURNAL_SENTINELS);
  return journal;
}

function commonById<T extends { id: string }>(left: readonly T[], right: readonly T[]): T[] {
  const rightIds = new Set(right.map(({ id }) => id));
  return left.filter(({ id }) => rightIds.has(id)).sort(byId);
}

function commonEntities<T extends { id: string; facts: readonly { id: string }[] }>(left: readonly T[], right: readonly T[]): T[] {
  const rightById = new Map(right.map((entity) => [entity.id, entity]));
  return left.flatMap((entity) => {
    const other = rightById.get(entity.id);
    return other === undefined ? [] : [{ ...entity, facts: commonById(entity.facts, other.facts) }];
  }).sort(byId);
}

export function buildPartyJournal(
  billView: PlayerView,
  ravenView: PlayerView,
  visibleTurns: readonly VisibleTurnSummary[],
): PlayerJournal {
  if (billView.audience !== "BILL" || ravenView.audience !== "RAVEN") throw new Error("PARTY_JOURNAL_VIEW_MISMATCH");
  if (billView.campaignId !== ravenView.campaignId || billView.stateVersion !== ravenView.stateVersion) {
    throw new Error("PARTY_JOURNAL_VERSION_MISMATCH");
  }
  const commonThreads = commonEntities(billView.openThreads, ravenView.openThreads);
  const objective = [...commonThreads]
    .sort((left, right) => objectivePriority(left.status) - objectivePriority(right.status) || byId(left, right))[0] ?? null;
  const billClues = collectClues(billView);
  const ravenClues = collectClues(ravenView);
  const commonRisk = billView.currentDecision.constraints === ravenView.currentDecision.constraints
    ? billView.currentDecision.constraints?.trim() || null : null;
  const journal = PlayerJournalSchema.parse({
    campaignId: billView.campaignId,
    stateVersion: billView.stateVersion,
    audience: "PARTY",
    worldDate: billView.worldDate,
    location: { id: billView.location.id, name: billView.location.name, status: billView.location.status },
    currentObjective: objective,
    immediateRisk: commonRisk,
    knownNpcs: commonEntities(billView.npcs, ravenView.npcs),
    knownClues: commonById(billClues, ravenClues),
    inventory: commonById(billView.inventory, ravenView.inventory).map((item) => ({
      id: item.id, name: item.name, quantity: item.quantity,
      currency: item.facts.some(({ kind }) => kind.toLowerCase().includes("currency"))
        || /\b(?:copper|silver|electrum|gold|platinum)\b/i.test(item.name),
    })),
    actorStatus: commonById(billView.actors, ravenView.actors).map((actor) => ({
      id: actor.id, name: actor.name, controller: actor.controller, level: actor.level,
      experiencePoints: actor.experiencePoints, currentHp: actor.currentHp, maxHp: actor.maxHp,
      temporaryHp: actor.temporaryHp, conditions: [...actor.conditions].sort(), resources: [],
    })),
    openThreads: commonThreads,
    acceptedRulings: commonById(billView.acceptedRulings, ravenView.acceptedRulings),
    recentTurns: recentTurns(visibleTurns),
  });
  assertNoForbiddenSentinels(journal, JOURNAL_SENTINELS);
  return journal;
}
