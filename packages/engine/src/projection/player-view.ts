import {
  PlayerViewSchema,
  type Audience,
  type PlayerSeat,
  type WorldState,
  type PlayerView,
} from "@third-chair/contracts";
import { allowedAudiences, visible } from "./audience.js";

const forbiddenKeys = new Set(["secret", "hidden", "director", "adventureSpine", "rngSeed", "rawSourceText"]);

export function assertNoForbiddenSentinels(value: unknown, sentinels: readonly string[]): void {
  const visit = (candidate: unknown): void => {
    if (typeof candidate === "string") {
      const found = sentinels.find((sentinel) => candidate.includes(sentinel));
      if (found) throw new Error(`Forbidden sentinel in player view: ${found}`);
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (candidate !== null && typeof candidate === "object") {
      for (const [key, nested] of Object.entries(candidate)) {
        if (forbiddenKeys.has(key)) throw new Error(`Forbidden player view key: ${key}`);
        visit(nested);
      }
    }
  };
  visit(value);
}

function visibleFacts(records: readonly { id: string; audience: Audience; kind: string; text: string }[], viewer: PlayerSeat) {
  return visible(records, viewer).map(({ id, kind, text }) => ({ id, kind, text }));
}

function entityView(record: { id: string; name: string; status: string; facts: readonly { id: string; audience: Audience; kind: string; text: string }[] }, viewer: PlayerSeat) {
  return { id: record.id, name: record.name, status: record.status, facts: visibleFacts(record.facts, viewer) };
}

export function projectPlayerView(state: WorldState, viewer: PlayerSeat): PlayerView {
  const allowed = allowedAudiences(viewer);
  const visibleNpcs = visible(Object.values(state.npcs), viewer);
  const knownCombatIds = new Set([
    ...Object.entries(state.actors).filter(([, actor]) => actor.controller !== "DIRECTOR").map(([id]) => id),
    ...visibleNpcs.map((npc) => npc.id),
  ]);
  const ownsDecision = state.currentDecision.owner === viewer || state.currentDecision.owner === "BOTH";
  const decision = {
    id: state.currentDecision.id,
    stateVersion: state.currentDecision.stateVersion,
    mode: state.currentDecision.mode,
    owner: state.currentDecision.owner,
    situation: state.currentDecision.situation,
    ...(ownsDecision ? {
      eligibleActorIds: [...state.currentDecision.eligibleActorIds],
      constraints: state.currentDecision.constraints,
      requiredInput: state.currentDecision.requiredInput,
      legalOptions: [...state.currentDecision.legalOptions],
    } : {}),
  };
  const location = state.locations[state.metadata.currentLocationId];
  if (!location || !allowed.has(location.audience)) throw new Error("Current location is not visible to player");

  const view = {
    campaignId: state.metadata.campaignId,
    stateVersion: state.metadata.stateVersion,
    worldDate: {
      yearDr: state.metadata.worldDate.yearDr,
      month: state.metadata.worldDate.month,
      day: state.metadata.worldDate.day,
    },
    location: entityView(location, viewer),
    sceneId: state.metadata.sceneId,
    actors: Object.entries(state.actors)
      .filter(([, actor]) => actor.controller !== "DIRECTOR")
      .map(([id, actor]) => ({
        id, controller: actor.controller, name: actor.name, level: actor.level,
        abilities: {
          strength: actor.abilities.strength, dexterity: actor.abilities.dexterity,
          constitution: actor.abilities.constitution, intelligence: actor.abilities.intelligence,
          wisdom: actor.abilities.wisdom, charisma: actor.abilities.charisma,
        },
        proficiencyBonus: actor.proficiencyBonus, armorClass: actor.armorClass, maxHp: actor.maxHp,
        currentHp: actor.currentHp, temporaryHp: actor.temporaryHp, speed: actor.speed, conditions: [...actor.conditions],
        deathSaves: { successes: actor.deathSaves.successes, failures: actor.deathSaves.failures }, publicNotes: [...actor.publicNotes],
        ...(actor.controller === viewer ? {
          resources: Object.values(actor.resources).map((resource) => ({
            id: resource.id, name: resource.name, current: resource.current, maximum: resource.maximum,
          })),
          scopedNotes: visible(actor.scopedNotes, viewer).map(({ id: noteId, text }) => ({ id: noteId, text })),
        } : {}),
      })),
    inventory: (() => {
      const selectedItems = Object.values(state.inventory)
        .filter((item) => item.ownerActorId !== null && state.actors[item.ownerActorId]?.controller === viewer);
      const selectedItemIds = new Set(selectedItems.map((item) => item.id));
      return selectedItems
      .map((item) => ({
        id: item.id, name: item.name, ownerActorId: item.ownerActorId,
        containerId: item.containerId !== null && selectedItemIds.has(item.containerId) ? item.containerId : null,
        quantity: item.quantity, equippedSlots: [...item.equippedSlots], facts: visibleFacts(item.facts, viewer),
      }));
    })(),
    npcs: visibleNpcs.map((npc) => entityView(npc, viewer)),
    factions: visible(Object.values(state.factions), viewer).map((faction) => entityView(faction, viewer)),
    facts: visibleFacts(state.facts, viewer),
    events: visible(state.events, viewer).map(({ id, kind, text }) => ({ id, kind, text })),
    clocks: visible(Object.values(state.clocks), viewer).map((clock) => ({
      id: clock.id, name: clock.name, status: clock.status, current: clock.current, maximum: clock.maximum, facts: visibleFacts(clock.facts, viewer),
    })),
    openThreads: visible(Object.values(state.quests), viewer).map((quest) => entityView(quest, viewer)),
    combat: state.combat === null ? null : {
      id: state.combat.id,
      round: state.combat.round,
      currentActorId: knownCombatIds.has(state.combat.currentActorId) ? state.combat.currentActorId : null,
      initiativeOrder: state.combat.initiativeOrder.filter((id) => knownCombatIds.has(id)),
      facts: visibleFacts(state.combat.facts, viewer),
    },
    currentDecision: decision,
    recoveryStatus: "NONE" as const,
  };
  assertNoForbiddenSentinels(view, []);
  return PlayerViewSchema.parse(view);
}
