import { describe, expect, it } from "vitest";
import { AdvanceGameOutputSchema } from "@third-chair/contracts";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";
import { projectPlayerView } from "@third-chair/engine";

describe("advance_game player-safe output", () => {
  it("accepts a Raven view whose next Bill-owned decision hides owner-only fields", () => {
    const state = structuredClone(minimumWorldState);
    state.currentDecision = { ...state.currentDecision, owner: "BILL", eligibleActorIds: ["test_actor_bill"] };
    const view = projectPlayerView(state, "RAVEN");
    expect(view.currentDecision.eligibleActorIds).toBeUndefined();
    expect(AdvanceGameOutputSchema.safeParse({
      kind: "COMMITTED",
      lockedIntents: [],
      visibleRolls: [],
      narration: null,
      currentStatus: { stateVersion: view.stateVersion },
      nextDecision: view.currentDecision,
      view,
    }).success).toBe(true);
  });

  it("rejects unstructured narration at the player-safe output boundary", () => {
    const view = projectPlayerView(minimumWorldState, "RAVEN");
    expect(AdvanceGameOutputSchema.safeParse({
      kind: "COMMITTED",
      lockedIntents: [],
      visibleRolls: [],
      narration: "unbounded narration",
      currentStatus: { stateVersion: view.stateVersion },
      nextDecision: view.currentDecision,
      view,
    }).success).toBe(false);
  });
});
