import { CombatStateSchema, DecisionRequestSchema, WorldStateSchema, type WorldOperation, type WorldState } from "@third-chair/contracts";
import { validateOperation, type OperationContext } from "./validate.js";

export interface OperationAudit { readonly operationId: string; readonly kind: WorldOperation["kind"]; }
export interface AppliedOperations { readonly candidate: WorldState; readonly audit: readonly OperationAudit[]; }
export function applyOperationsToClone(state: WorldState, operations: readonly WorldOperation[], context: OperationContext): AppliedOperations {
  const candidate = structuredClone(state);
  const audit: OperationAudit[] = [];
  for (const raw of operations) {
    const op = validateOperation(candidate, raw, context);
    switch (op.kind) {
      case "SET_HP": candidate.actors[op.actorId]!.currentHp = op.value; break;
      case "SET_TEMP_HP": candidate.actors[op.actorId]!.temporaryHp = op.value; break;
      case "SPEND_RESOURCE": candidate.actors[op.actorId]!.resources[op.resourceId]!.current -= op.amount; break;
      case "RESTORE_RESOURCE": candidate.actors[op.actorId]!.resources[op.resourceId]!.current += op.amount; break;
      case "ADD_CONDITION": candidate.actors[op.actorId]!.conditions.push(op.condition); break;
      case "REMOVE_CONDITION": candidate.actors[op.actorId]!.conditions = candidate.actors[op.actorId]!.conditions.filter((condition) => condition !== op.condition); break;
      case "MOVE_ACTOR": if (!candidate.locations[op.locationId]) throw new Error("UNKNOWN_LOCATION"); candidate.metadata.currentLocationId = op.locationId; break;
      case "ADD_INVENTORY": candidate.inventory[op.item.id] = op.item; break;
      case "REMOVE_INVENTORY": if (!candidate.inventory[op.itemId]) throw new Error("UNKNOWN_INVENTORY"); delete candidate.inventory[op.itemId]; break;
      case "SET_EQUIPPED": if (!candidate.inventory[op.itemId]) throw new Error("UNKNOWN_INVENTORY"); candidate.inventory[op.itemId]!.equippedSlots = [...op.slots]; break;
      case "SET_COMBAT": candidate.combat = op.combat === null ? null : CombatStateSchema.parse(op.combat); break;
      case "ADVANCE_INITIATIVE": if (!candidate.combat) throw new Error("NO_COMBAT"); { const i = candidate.combat.initiativeOrder.indexOf(candidate.combat.currentActorId); candidate.combat.currentActorId = candidate.combat.initiativeOrder[(i + 1) % candidate.combat.initiativeOrder.length]!; } break;
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
