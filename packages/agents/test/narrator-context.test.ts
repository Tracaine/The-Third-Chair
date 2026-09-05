import { describe, expect, test } from "vitest";
import { WorldStateSchema, type CheckResolution, type WorldOperation } from "@third-chair/contracts";
import { minimumWorldStateInput, billIntent, ravenIntent } from "@third-chair/contracts/test/fixtures";
import { projectPlayerView } from "@third-chair/engine";
import { ContextBudgetError } from "../src/context/budget.js";
import { buildNarratorInput, NarratorInputSchema, type NarratorBuildInput } from "../src/context/narrator-context.js";

const resolution: CheckResolution = {
  id: "test_resolution",
  planId: "test_plan",
  actorId: "test_actor_raven",
  checkKind: "ability",
  key: "dexterity",
  naturalDice: [17], keptDie: 17, modifier: 3, total: 20, target: 14, tier: "SUCCESS",
  visibility: "PUBLIC", advantage: "NORMAL", advantageReason: "Clear footing",
  successStakes: "Cross safely", failureStakes: "Lose time", citations: [],
  startingCounter: 0, endingCounter: 1,
};

function narrationStates() {
  const before = WorldStateSchema.parse({
    ...minimumWorldStateInput,
    actors: {
      ...minimumWorldStateInput.actors,
      test_actor_bill: {
        ...minimumWorldStateInput.actors.test_actor_bill,
        scopedNotes: [{ id: "test_note_bill", audience: "BILL", text: "SENTINEL_BILL_MEMORY" }],
      },
      test_actor_raven: {
        ...minimumWorldStateInput.actors.test_actor_raven,
        scopedNotes: [{ id: "test_note_raven", audience: "RAVEN", text: "SENTINEL_RAVEN_MEMORY" }],
      },
    },
    npcs: {
      test_npc_visible: { id: "test_npc_visible", audience: "PUBLIC", name: "Guide", status: "Neutral", facts: [] },
    },
  });
  const after = WorldStateSchema.parse({
    ...before,
    inventory: {
      test_item_raven: {
        id: "test_item_raven", name: "Brass key", ownerActorId: "test_actor_raven", containerId: null, quantity: 1,
        equippedSlots: [],
        facts: [
          { id: "test_item_fact_public", audience: "PUBLIC", kind: "appearance", text: "Warm to the touch" },
          { id: "test_item_fact_hidden", audience: "DIRECTOR", kind: "curse", text: "SENTINEL_NESTED_INVENTORY_FACT" },
        ],
      },
    },
    events: [
      { id: "test_event_raven", audience: "RAVEN", kind: "discovery", text: "Raven finds the key." },
      { id: "test_event_hidden", audience: "DIRECTOR", kind: "betrayal", text: "SENTINEL_NESTED_EVENT" },
    ],
  });
  return { before, after };
}

describe("buildNarratorInput", () => {
  function args(): NarratorBuildInput {
    const { before, after } = narrationStates();
    return { beforeView: projectPlayerView(before, "RAVEN"), afterView: projectPlayerView(after, "RAVEN"),
      lockedIntents: [billIntent, ravenIntent], persistedPlan: null, persistedResolutions: [resolution],
      visibleOperations: [], visibleEvents: [], toneSettings: { style: "grounded", contentLimits: [] },
      narrativeBrief: { summary: "A crossing", requiredResolutionIds: [resolution.id], requiredEventIds: [] } };
  }

  test("materializes defaulted intent arrays and normalizes non-persisted input", () => {
    const { targetIds: _targets, committedResourceIds: _resources, ...intent } = billIntent;
    const rawIntent = { ...intent, declaredAction: "  Open the door  " };
    const input = buildNarratorInput({ ...args(), lockedIntents: [rawIntent, ravenIntent] });
    expect(input.lockedIntents[0]).toEqual(billIntent);
    expect(input.diagnostic.bytes.narratorInput).toBe(Buffer.byteLength(JSON.stringify(input), "utf8"));
    expect(rawIntent).not.toHaveProperty("targetIds");
    expect(rawIntent.declaredAction).toBe("  Open the door  ");
  });

  test.each(["recentTurnSummaries", "selectedMemories"] as const)("rejects duplicate %s IDs in both input orders and the output schema", (field) => {
    const records = field === "recentTurnSummaries"
      ? ["SENTINEL_FIRST", "SENTINEL_SECOND"].map((summary) => ({ id: "test_duplicate", turnNumber: 1, summary }))
      : ["SENTINEL_FIRST", "SENTINEL_SECOND"].map((text) => ({ id: "test_duplicate", audience: "PUBLIC" as const, text, relatedEntityIds: ["test_actor_bill"], relevance: 1 }));
    const base = args();
    const output = buildNarratorInput(base);
    for (const values of [records, [...records].reverse()]) {
      let caught: unknown;
      try { buildNarratorInput({ ...base, [field]: values }); } catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(ContextBudgetError);
      expect((caught as ContextBudgetError).violations).toEqual([expect.objectContaining({ field, issueCount: 1, actualBytes: expect.any(Number) })]);
      expect(String(caught)).not.toContain("SENTINEL");
      expect(NarratorInputSchema.safeParse({ ...output, [field]: values }).success).toBe(false);
    }
  });

  test("accepts strict output and removes all scopedNotes without mutating views", () => {
    const raw = args();
    const snapshot = structuredClone(raw);
    const result = buildNarratorInput(raw);
    expect(NarratorInputSchema.safeParse(result).success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("SENTINEL_RAVEN_MEMORY");
    expect(JSON.stringify(buildNarratorInput({ ...raw, viewer: "BILL", beforeView: projectPlayerView(narrationStates().before, "BILL"), afterView: projectPlayerView(narrationStates().after, "BILL") }))).not.toContain("SENTINEL_BILL_MEMORY");
    expect(raw).toEqual(snapshot);
  });

  test("never passes secret checks or resolutions, or requirements for hidden outcomes", () => {
    const raw = args();
    const result = buildNarratorInput({ ...raw, persistedResolutions: [resolution, { ...resolution, id: "test_secret", visibility: "SECRET", successStakes: "SENTINEL_SECRET_RESOLUTION" }] });
    expect(result.persistedResolutions.map(({ id }) => id)).toEqual([resolution.id]);
    expect(JSON.stringify(result)).not.toContain("SENTINEL_SECRET_RESOLUTION");
    expect(() => buildNarratorInput({ ...raw, narrativeBrief: { ...raw.narrativeBrief, requiredResolutionIds: ["test_secret"] } })).toThrow(ContextBudgetError);
  });

  test("drops optional histories before any mandatory resolution data at the total cap", () => {
    const raw = args();
    const input = buildNarratorInput({ ...raw,
      recentTurnSummaries: Array.from({ length: 12 }, (_, i) => ({ id: `test_summary_${i}`, turnNumber: i, summary: "x".repeat(2_000) })),
      selectedMemories: [
        { id: "test_low", audience: "PUBLIC", text: "x".repeat(15_000), relevance: 1, relatedEntityIds: ["test_actor_raven"] },
        { id: "test_high", audience: "PUBLIC", text: "y".repeat(15_000), relevance: 9, relatedEntityIds: ["test_actor_raven"] },
        { id: "test_private", audience: "RAVEN", text: "SENTINEL_PRIVATE_MEMORY", relevance: 100, relatedEntityIds: ["test_actor_raven"] },
      ],
    });
    expect(input.recentTurnSummaries).toEqual([]);
    expect(input.selectedMemories.map(({ id }) => id)).toEqual(["test_high"]);
    expect(input.persistedResolutions).toEqual([resolution]);
    expect(input.diagnostic.dropped.turnSummaries).toBe(12);
    expect(Buffer.byteLength(JSON.stringify(input), "utf8")).toBeLessThanOrEqual(32_000);
    expect(JSON.stringify(input)).not.toContain("SENTINEL_PRIVATE_MEMORY");
  });

  test("counts persisted resolutions in the mandatory total", () => {
    const raw = args();
    expect(() => buildNarratorInput({ ...raw, persistedResolutions: Array.from({ length: 100 }, (_, i) => ({ ...resolution, id: `test_resolution_${i}` })), narrativeBrief: { ...raw.narrativeBrief, requiredResolutionIds: [] } })).toThrow(ContextBudgetError);
  });

  test("the exported schema cannot admit private memories or secret resolutions", () => {
    const input = buildNarratorInput(args());
    expect(NarratorInputSchema.safeParse({ ...input, persistedResolutions: [{ ...resolution, visibility: "SECRET" }] }).success).toBe(false);
    expect(NarratorInputSchema.safeParse({ ...input, selectedMemories: [{ id: "test_private", audience: "RAVEN", text: "SENTINEL_PRIVATE", relevance: 1, relatedEntityIds: ["test_actor_raven"] }] }).success).toBe(false);
  });

  test("filters secret plan checks, preserves visible persisted checks, and counts the plan", () => {
    const raw = args();
    const check = { id: "test_check", actorId: "test_actor_raven", checkKind: "ability", key: "dexterity", sides: 20,
      advantage: "NORMAL" as const, advantageReason: "  exact saved reason  ", modifier: 3, dc: 14,
      visibility: "PUBLIC" as const, successStakes: "Cross safely", failureStakes: "Lose time", permittedOutcomeTiers: ["SUCCESS" as const], citations: [] };
    const plan = { id: "test_plan", checks: [check, { ...check, id: "test_secret_check", visibility: "SECRET" as const, successStakes: "SENTINEL_SECRET_PLAN" }] };
    const result = buildNarratorInput({ ...raw, persistedPlan: plan });
    expect(result.persistedPlan).toEqual({ id: "test_plan", checks: [check] });
    expect(JSON.stringify(result)).not.toContain("SENTINEL_SECRET_PLAN");
    expect(result.diagnostic.bytes.narratorInput).toBe(Buffer.byteLength(JSON.stringify(result), "utf8"));
    expect(() => buildNarratorInput({ ...raw, persistedPlan: { id: "test_plan", checks: Array.from({ length: 20 }, (_, i) => ({ ...check, id: `test_check_${i}`, citations: Array.from({ length: 20 }, () => "x".repeat(1_000)) })) } })).toThrow(ContextBudgetError);
  });

  test("keeps exact mandatory turn data and caps the serialized input", () => {
    const { before, after } = narrationStates();
    const input = buildNarratorInput({
      viewer: "RAVEN",
      beforeView: projectPlayerView(before, "RAVEN"),
      afterView: projectPlayerView(after, "RAVEN"),
      lockedIntents: [billIntent, ravenIntent],
      persistedPlan: null,
      persistedResolutions: [resolution],
      visibleOperations: [],
      visibleEvents: [{ id: "test_event_raven" }],
      toneSettings: { style: "grounded", pacing: "brisk", contentLimits: [] },
      narrativeBrief: {
        summary: "Raven crosses and finds a key.",
        requiredResolutionIds: ["test_resolution"],
        requiredEventIds: ["test_event_raven"],
      },
    });

    expect(input.lockedIntents).toEqual([billIntent, ravenIntent]);
    expect(input.persistedResolutions).toEqual([resolution]);
    expect(input.visibleEvents).toEqual([{ id: "test_event_raven", kind: "discovery", text: "Raven finds the key." }]);
    expect(Buffer.byteLength(JSON.stringify(input), "utf8")).toBeLessThanOrEqual(32_000);
  });

  test("rejects oversized mandatory visible projections with field byte counts", () => {
    const { before, after } = narrationStates();
    const afterView = projectPlayerView(after, "RAVEN");
    const secret = "SENTINEL_OVERSIZED_NARRATOR";
    const oversizedAfter = {
      ...afterView,
      events: Array.from({ length: 20 }, (_, index) => ({
        id: `test_large_event_${index}`,
        kind: "observation",
        text: `${index === 0 ? secret : ""}${"x".repeat(1_900)}`,
      })),
    };

    let caught: unknown;
    try {
      buildNarratorInput({
        beforeView: projectPlayerView(before, "RAVEN"),
        afterView: oversizedAfter,
        lockedIntents: [billIntent, ravenIntent],
        persistedPlan: null,
        persistedResolutions: [resolution],
        visibleOperations: [],
        visibleEvents: [],
        toneSettings: { style: "grounded", contentLimits: [] },
        narrativeBrief: { summary: "A large scene", requiredResolutionIds: ["test_resolution"], requiredEventIds: [] },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ContextBudgetError);
    const budgetError = caught as ContextBudgetError;
    expect(budgetError.violations).toEqual([
      expect.objectContaining({ field: "narratorInput", maximumBytes: 32_000 }),
    ]);
    expect(budgetError.violations[0]?.actualBytes).toBeGreaterThan(32_000);
    expect(budgetError.message).not.toContain(secret);
  });
});
