import { CombatStateSchema, DecisionRequestSchema, WorldStateSchema, type WorldOperation, type WorldState } from "@third-chair/contracts";
import { validateOperation, type OperationContext } from "./validate.js";

export interface OperationAudit { readonly operationId: string; readonly kind: WorldOperation["kind"]; }
export interface AppliedOperations { readonly candidate: WorldState; readonly audit: readonly OperationAudit[]; }
export function applyOperationsToClone(state: WorldState, operations: readonly WorldOperation[], context: OperationContext): AppliedOperations {
  const candidate = structuredClone(state);
  const audit: OperationAudit[] = [];
  const usedDeathSaves = new Set<string>();
  const castByActor = new Set<string>();
  for (const raw of operations) {
    const op = validateOperation(candidate, raw, context);
    switch (op.kind) {
      case "SET_HP": {
        const actor = candidate.actors[op.actorId]!;
        if (actor.conditions.includes("Dead") || actor.deathSaves.failures === 3) throw new Error("CHARACTER_DEAD");
        const before = actor.currentHp;
        actor.currentHp = Math.max(0, Math.min(actor.maxHp, op.value));
        if (op.value <= -actor.maxHp && actor.maxHp > 0) {
          actor.deathSaves.failures = 3;
          actor.conditions = [...new Set([...actor.conditions, "Dead"])];
        } else if (actor.currentHp === 0) {
          actor.conditions = [...new Set([...actor.conditions, "Unconscious"])];
        } else if (before <= 0) {
          actor.deathSaves = { successes: 0, failures: 0 };
          actor.conditions = actor.conditions.filter((condition) => condition !== "Unconscious");
        }
        break;
      }
      case "APPLY_DEATH_SAVE": {
        if (op.cause.type !== "RESOLUTION" || usedDeathSaves.has(op.cause.resolutionId)) throw new Error("INVALID_DEATH_SAVE");
        usedDeathSaves.add(op.cause.resolutionId);
        const actor = candidate.actors[op.actorId]!;
        const resolutionId = op.cause.resolutionId;
        const roll = context.resolutions.find(({ id }) => id === resolutionId)!;
        if (roll.keptDie === 20) {
          actor.currentHp = 1;
          actor.deathSaves = { successes: 0, failures: 0 };
          actor.conditions = actor.conditions.filter((condition) => condition !== "Unconscious");
        } else if (roll.total >= 10) {
          actor.deathSaves.successes++;
        } else {
          actor.deathSaves.failures = Math.min(3, actor.deathSaves.failures + (roll.keptDie === 1 ? 2 : 1));
          if (actor.deathSaves.failures === 3) actor.conditions = [...new Set([...actor.conditions, "Dead"])];
        }
        break;
      }
      case "CAST_SPELL": {
        if (castByActor.has(op.actorId)) throw new Error("DUPLICATE_SPELL_CAST");
        castByActor.add(op.actorId);
        const actor = candidate.actors[op.actorId]!;
        const level = actor.mechanics?.spellcasting?.spellLevels?.[op.spellId] ?? 0;
        if (level > 0) actor.spellSlots![String(level)]!.current--;
        break;
      }
      case "SET_TEMP_HP": candidate.actors[op.actorId]!.temporaryHp = op.value; break;
      case "SPEND_RESOURCE": candidate.actors[op.actorId]!.resources[op.resourceId]!.current -= op.amount; break;
      case "RESTORE_RESOURCE": candidate.actors[op.actorId]!.resources[op.resourceId]!.current += op.amount; break;
      case "ADD_CONDITION": candidate.actors[op.actorId]!.conditions.push(op.condition); break;
      case "REMOVE_CONDITION": candidate.actors[op.actorId]!.conditions = candidate.actors[op.actorId]!.conditions.filter((condition) => condition !== op.condition); break;
      case "MOVE_ACTOR": {
        const actor = candidate.actors[op.actorId]!;
        actor.locationId = op.locationId;
        if (actor.controller === "DIRECTOR") break;
        const players = Object.values(candidate.actors).filter((entry) => entry.controller !== "DIRECTOR" && entry.deathSaves.failures < 3);
        if (players.every((entry) => (entry.locationId ?? candidate.metadata.currentLocationId) === op.locationId)) {
          candidate.metadata.currentLocationId = op.locationId;
          candidate.metadata.sceneId = op.id;
        }
        break;
      }
      case "ADD_INVENTORY": candidate.inventory[op.item.id] = op.item; break;
      case "REMOVE_INVENTORY": if (!candidate.inventory[op.itemId]) throw new Error("UNKNOWN_INVENTORY"); delete candidate.inventory[op.itemId]; break;
      case "SET_EQUIPPED": if (!candidate.inventory[op.itemId]) throw new Error("UNKNOWN_INVENTORY"); candidate.inventory[op.itemId]!.equippedSlots = [...op.slots]; break;
      case "SET_COMBAT": candidate.combat = op.combat === null ? null : CombatStateSchema.parse(op.combat); break;
      case "ADVANCE_INITIATIVE": if (!candidate.combat) throw new Error("NO_COMBAT"); { const i = candidate.combat.initiativeOrder.indexOf(candidate.combat.currentActorId); candidate.combat.currentActorId = candidate.combat.initiativeOrder[(i + 1) % candidate.combat.initiativeOrder.length]!; } break;
      case "ADD_LOCATION":
        if (candidate.locations[op.location.id]) throw new Error("LOCATION_ALREADY_EXISTS");
        candidate.locations[op.location.id] = op.location;
        break;
      case "ADD_NPC":
        if (candidate.npcs[op.npc.id] || candidate.actors[op.npc.id]) throw new Error("NPC_ALREADY_EXISTS");
        candidate.npcs[op.npc.id] = op.npc;
        break;
      case "OBSERVE_ENTITY": {
        const records = op.entityType === "NPC" ? candidate.npcs : op.entityType === "FACTION" ? candidate.factions : candidate.quests;
        const record = records[op.entityId];
        if (record?.audience !== "DIRECTOR" || !["PUBLIC", "PARTY"].includes(op.audience)) throw new Error("ENTITY_NOT_AVAILABLE_TO_OBSERVE");
        records[op.entityId] = { ...record, name: op.name, status: op.status, audience: op.audience,
          facts: record.name === op.name ? record.facts
            : [...record.facts, { id: op.id, audience: "DIRECTOR", kind: "Original Identity", text: record.name }] };
        break;
      }
      case "DISCOVER_CLUE": {
        const clue = candidate.facts.find(({ id }) => id === op.clueId);
        if (!clue || (clue.kind !== "Undiscovered Clue" && clue.kind !== "Clue")) throw new Error("CLUE_NOT_AVAILABLE_TO_DISCOVER");
        if ((clue.audience === "BILL" || clue.audience === "RAVEN") && op.audience !== "PARTY" && op.audience !== clue.audience) {
          throw new Error("CLUE_SHARING_REQUIRES_PARTY_AUDIENCE");
        }
        if (clue.audience === "DIRECTOR" || op.audience === "PARTY" && clue.audience !== "PUBLIC") {
          clue.audience = op.audience;
          clue.kind = "Clue";
        }
        break;
      }
      case "SET_CAMPAIGN_PROGRESS": candidate.campaignProgress = op.progress; break;
      case "ADD_FACT": candidate.facts.push(op.fact); break;
      case "ADD_EVENT": candidate.events.push(op.event); break;
      case "ADVANCE_CLOCK": { const clock = candidate.clocks[op.clockId]; if (!clock) throw new Error("UNKNOWN_CLOCK"); clock.current = Math.min(clock.maximum, clock.current + op.amount); } break;
      case "SET_NPC_ATTITUDE": if (!candidate.npcs[op.npcId]) throw new Error("UNKNOWN_NPC"); candidate.npcs[op.npcId]!.status = op.status; break;
      case "SET_QUEST_STATUS": if (!candidate.quests[op.questId]) throw new Error("UNKNOWN_QUEST"); candidate.quests[op.questId]!.status = op.status; break;
      case "SET_FLAG": candidate.flags = [...candidate.flags.filter((flag) => flag.id !== op.flag.id), op.flag]; break;
      case "SET_DECISION": candidate.currentDecision = DecisionRequestSchema.parse(op.decision); break;
    }
    audit.push({ operationId: op.id, kind: op.kind });
  }
  return { candidate: WorldStateSchema.parse(candidate), audit };
}
