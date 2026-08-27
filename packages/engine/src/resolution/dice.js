import { CheckResolutionSchema, ResolutionPlanSchema } from "@third-chair/contracts";
import { deterministicDie } from "../rng/hmac-rng.js";
function tier(natural, total, target) {
    if (natural === 20)
        return "CRITICAL_SUCCESS";
    if (natural === 1)
        return "CRITICAL_FAILURE";
    return total >= target ? "SUCCESS" : "FAILURE";
}
export function resolvePlan(seed, campaignId, counter, rawPlan) {
    const plan = ResolutionPlanSchema.parse(rawPlan);
    let next = counter;
    const resolutions = plan.checks.map((check) => {
        const startingCounter = next;
        const naturalDice = check.advantage === "NORMAL"
            ? [deterministicDie(seed, campaignId, next++, 0, check.sides)]
            : [deterministicDie(seed, campaignId, next++, 0, check.sides), deterministicDie(seed, campaignId, next++, 1, check.sides)];
        const keptDie = check.advantage === "ADVANTAGE" ? Math.max(...naturalDice) : check.advantage === "DISADVANTAGE" ? Math.min(...naturalDice) : naturalDice[0];
        return CheckResolutionSchema.parse({
            id: check.id, planId: plan.id, actorId: check.actorId, checkKind: check.checkKind, key: check.key,
            naturalDice, keptDie, modifier: check.modifier, total: keptDie + check.modifier, target: check.dc,
            tier: tier(keptDie, keptDie + check.modifier, check.dc), visibility: check.visibility,
            advantage: check.advantage, advantageReason: check.advantageReason, successStakes: check.successStakes,
            failureStakes: check.failureStakes, citations: check.citations, startingCounter, endingCounter: next,
        });
    });
    return { resolutions, nextRngCounter: next };
}
//# sourceMappingURL=dice.js.map