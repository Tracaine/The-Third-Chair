import { describe, expect, it } from "vitest";
import { applyOperationsToClone } from "@third-chair/engine";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";
const resolution = { id: "test_resolution", planId: "test_plan", actorId: "test_actor_bill", checkKind: "Check", key: "skill", naturalDice: [2], keptDie: 2, modifier: 0, total: 2, target: 10, tier: "FAILURE" as const, visibility: "PUBLIC" as const, advantage: "NORMAL" as const, advantageReason: "none", successStakes: "win", failureStakes: "lose", citations: [], startingCounter: 0, endingCounter: 1 };
const context = { intents: [{ seat: "BILL" as const, actorId: "test_actor_bill", mode: "ACT" as const, declaredAction: "Search", desiredOutcome: "Find", approach: "Carefully", committedResourceIds: [], targetIds: [], contingency: "Stop" }], resolutions: [resolution] };
const base = { id: "test_operation", reason: "test", audience: "PUBLIC" as const, cause: { type: "RESOLUTION" as const, resolutionId: "test_resolution", allowedOutcomeTiers: ["SUCCESS" as const] } };
describe("Sacred No", () => {
  it("rejects the wrong tier and never mutates source state", () => {
    const state = structuredClone(minimumWorldState); const before = structuredClone(state);
    expect(() => applyOperationsToClone(state, [{ ...base, kind: "SET_HP" as const, actorId: "test_actor_bill", value: 1 }], context)).toThrow("OPERATION_OUTCOME_TIER_MISMATCH");
    expect(state).toEqual(before);
  });
  it("rejects resource underflow and invented player dialogue", () => {
    const state = structuredClone(minimumWorldState); state.actors.test_actor_bill!.resources.test_resource = { id: "test_resource", name: "Slot", current: 0, maximum: 1 };
    const permitted = { ...base, cause: { ...base.cause, allowedOutcomeTiers: ["FAILURE" as const] } };
    expect(() => applyOperationsToClone(state, [{ ...permitted, kind: "SPEND_RESOURCE" as const, actorId: "test_actor_bill", resourceId: "test_resource", amount: 1 }], context)).toThrow("RESOURCE_UNDERFLOW");
    expect(() => applyOperationsToClone(state, [{ ...permitted, kind: "ADD_EVENT" as const, event: { id: "test_event", audience: "PUBLIC" as const, kind: "Dialogue", text: "Bill agrees to the bargain." } }], context)).toThrow("PLAYER_AUTHORITY_VIOLATION");
  });
});
