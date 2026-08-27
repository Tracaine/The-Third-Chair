import { CheckResolutionSchema, ResolutionPlanSchema, type CheckResolution, type ResolutionPlan } from "@third-chair/contracts";
import { deterministicDie } from "../rng/hmac-rng.js";

export interface ResolvedPlan { readonly resolutions: readonly CheckResolution[]; readonly nextRngCounter: number; }
function tier(natural: number, total: number, target: number): CheckResolution["tier"] {
  if (natural === 20) return "CRITICAL_SUCCESS";
  if (natural === 1) return "CRITICAL_FAILURE";
  return total >= target ? "SUCCESS" : "FAILURE";
}
export function resolvePlan(seed: Uint8Array, campaignId: string, counter: number, rawPlan: ResolutionPlan): ResolvedPlan {
  const plan = ResolutionPlanSchema.parse(rawPlan);
  let next = counter;
  const resolutions = plan.checks.map((check) => {
    const startingCounter = next;
    const naturalDice = check.advantage === "NORMAL"
      ? [deterministicDie(seed, campaignId, next++, 0, check.sides)]
      : [deterministicDie(seed, campaignId, next++, 0, check.sides), deterministicDie(seed, campaignId, next++, 1, check.sides)];
    const keptDie = check.advantage === "ADVANTAGE" ? Math.max(...naturalDice) : check.advantage === "DISADVANTAGE" ? Math.min(...naturalDice) : naturalDice[0]!;
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
