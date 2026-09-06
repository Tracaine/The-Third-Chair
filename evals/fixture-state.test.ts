import { describe, expect, it } from "vitest";
import { stateForCase } from "./fixture-state.js";

describe("CHAIR-003 live case state", () => {
  it("does not give the no-roll Director contradictory obstacle facts", () => {
    const state = stateForCase("no-roll-safe-action");
    const location = state.locations[state.metadata.currentLocationId];
    expect(location?.status).toContain("unlocked");
    expect(state.currentDecision.situation).toContain("unlocked");
    expect(`${location?.status} ${state.currentDecision.situation}`).not.toMatch(/swollen|blocked|patrol/i);
  });

  it("retains the meaningful obstacle and pressure for roll cases", () => {
    const state = stateForCase("stakes-before-roll");
    const location = state.locations[state.metadata.currentLocationId];
    expect(location?.status).toMatch(/swollen|blocks/i);
    expect(state.currentDecision.situation).toMatch(/footsteps approach/i);
  });
});
