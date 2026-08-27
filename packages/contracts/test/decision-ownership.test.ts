import { describe, expect, it } from "vitest";
import { ActorIntentSchema, validateIntentsForDecision } from "@third-chair/contracts";
import { billIntent, bothDecision, minimumWorldState, ravenDecision, ravenIntent } from "./fixtures.js";

describe("decision ownership", () => {
  it("rejects a BOTH decision with only Bill's intent", () => {
    expect(() => validateIntentsForDecision(bothDecision, [billIntent], minimumWorldState)).toThrow(
      "Decision requires intents from BILL and RAVEN",
    );
  });

  it("rejects a server-authored player intent", () => {
    expect(() => ActorIntentSchema.parse({ ...billIntent, seat: "DIRECTOR" })).toThrow();
  });

  it("rejects a Raven intent for Bill's actor", () => {
    expect(() => validateIntentsForDecision(
      ravenDecision,
      [{ ...ravenIntent, actorId: "test_actor_bill" }],
      minimumWorldState,
    )).toThrow("Actor test_actor_bill is controlled by BILL");
  });

  it("rejects duplicate seats", () => {
    expect(() => validateIntentsForDecision(
      bothDecision,
      [billIntent, { ...billIntent, actorId: "test_actor_raven" }],
      minimumWorldState,
    )).toThrow("Duplicate intent for BILL");
  });

  it("rejects seats the decision does not own", () => {
    expect(() => validateIntentsForDecision(ravenDecision, [ravenIntent, billIntent], minimumWorldState))
      .toThrow("Decision does not accept intents from BILL");
  });

  it("rejects ineligible actors", () => {
    expect(() => validateIntentsForDecision(
      { ...ravenDecision, eligibleActorIds: ["test_actor_raven"] },
      [{ ...ravenIntent, actorId: "test_actor_bill" }],
      minimumWorldState,
    )).toThrow("Actor test_actor_bill is not eligible for this decision");
  });

  it("rejects ACT resources the actor does not own", () => {
    expect(() => validateIntentsForDecision(
      ravenDecision,
      [{ ...ravenIntent, committedResourceIds: ["test_resource"] }],
      minimumWorldState,
    )).toThrow("Actor test_actor_raven does not own resource test_resource");
  });
});
