import { describe, expect, it } from "vitest";
import { deterministicDie, resolvePlan } from "@third-chair/engine";
const seed = new Uint8Array(32);
const plan = { id: "test_plan", checks: [{ id: "test_check", actorId: "test_actor", checkKind: "Check", key: "skill", sides: 20, advantage: "ADVANTAGE", advantageReason: "help", modifier: 2, dc: 12, visibility: "PUBLIC", successStakes: "open", failureStakes: "cost", permittedOutcomeTiers: ["SUCCESS", "FAILURE"], citations: [] }] };
describe("deterministic dice", () => {
    it("uses fixed HMAC vectors", () => {
        expect(deterministicDie(seed, "camp_test", 0, 0, 20)).toBe(9);
        expect(deterministicDie(seed, "camp_test", 1, 0, 20)).toBe(5);
        expect(deterministicDie(seed, "camp_test", 2, 0, 6)).toBe(6);
        expect(deterministicDie(seed, "camp_test", 3, 1, 6)).toBe(4);
    });
    it("keeps the right natural die and consumes one counter per die", () => {
        const advantage = resolvePlan(seed, "camp_test", 0, plan).resolutions[0];
        const disadvantage = resolvePlan(seed, "camp_test", 0, { ...plan, checks: [{ ...plan.checks[0], advantage: "DISADVANTAGE" }] }).resolutions[0];
        expect(advantage.keptDie).toBe(Math.max(...advantage.naturalDice));
        expect(disadvantage.keptDie).toBe(Math.min(...disadvantage.naturalDice));
        expect(advantage.endingCounter - advantage.startingCounter).toBe(2);
        expect(JSON.stringify(resolvePlan(seed, "camp_test", 0, plan))).toBe(JSON.stringify(resolvePlan(seed, "camp_test", 0, plan)));
    });
});
//# sourceMappingURL=dice.test.js.map