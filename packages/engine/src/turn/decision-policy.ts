import { DecisionRequestSchema, type DecisionRequest, type WorldState } from "@third-chair/contracts";

export function deriveDecisionAuthority(candidate: WorldState, proposed: DecisionRequest): DecisionRequest {
  const decision = DecisionRequestSchema.parse(proposed);
  if (decision.mode === "ENDED" || candidate.campaignProgress?.phase === "ENDED") {
    if (decision.mode !== "ENDED" || decision.owner !== "DIRECTOR" || decision.eligibleActorIds.length
      || candidate.campaignProgress?.phase !== "ENDED") throw new Error("CAMPAIGN_CONCLUSION_DECISION_MISMATCH");
    return decision;
  }
  const alive = Object.entries(candidate.actors).filter(([, actor]) =>
    actor.controller !== "DIRECTOR" && actor.deathSaves.failures < 3
      && !actor.conditions.some((condition) => condition.toLowerCase() === "dead"));
  if (!alive.length) throw new Error("PARTY_DEFEAT_REQUIRES_CONCLUSION");
  const dead = new Set(Object.keys(candidate.actors).filter((id) =>
    candidate.actors[id]!.controller !== "DIRECTOR" && !alive.some(([actorId]) => actorId === id)));
  if (decision.eligibleActorIds.some((id) => dead.has(id))
    || (decision.owner === "BOTH" && new Set(alive.map(([, actor]) => actor.controller)).size < 2)
    || ((decision.owner === "BILL" || decision.owner === "RAVEN") && !alive.some(([, actor]) => actor.controller === decision.owner))) {
    throw new Error("DEAD_CHARACTER_CANNOT_OWN_DECISION");
  }
  if (candidate.combat !== null) {
    const actorId = candidate.combat.currentActorId;
    const actor = candidate.actors[actorId];
    if (actor) {
      if (actor.controller === "DIRECTOR") throw new Error("DIRECTOR_BEAT_MUST_AUTO_ADVANCE");
      if (decision.owner !== actor.controller || !decision.eligibleActorIds.includes(actorId)) throw new Error("DECISION_AUTHORITY_MISMATCH");
    }
  }
  return decision;
}
