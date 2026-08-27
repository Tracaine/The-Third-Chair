import { DecisionRequestSchema } from "@third-chair/contracts";
export function deriveDecisionAuthority(candidate, proposed) {
    const decision = DecisionRequestSchema.parse(proposed);
    if (candidate.combat !== null) {
        const actorId = candidate.combat.currentActorId;
        const actor = candidate.actors[actorId];
        if (actor) {
            if (actor.controller === "DIRECTOR")
                throw new Error("DIRECTOR_BEAT_MUST_AUTO_ADVANCE");
            if (decision.owner !== actor.controller || !decision.eligibleActorIds.includes(actorId))
                throw new Error("DECISION_AUTHORITY_MISMATCH");
        }
    }
    return decision;
}
//# sourceMappingURL=decision-policy.js.map