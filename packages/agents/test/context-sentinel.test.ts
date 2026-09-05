import { describe, expect, test } from "vitest";
import { WorldStateSchema, type WorldOperation } from "@third-chair/contracts";
import { minimumWorldStateInput, billIntent, ravenIntent } from "@third-chair/contracts/test/fixtures";
import { projectPlayerView } from "@third-chair/engine";
import { buildNarratorInput, type NarratorBuildInput } from "../src/context/narrator-context.js";

describe("Narrator context sentinel boundary", () => {
  const cause = { type: "SYSTEM" as const, systemRule: "TIME" as const };
  function request(before: ReturnType<typeof WorldStateSchema.parse>, after = before): NarratorBuildInput {
    return {
      beforeView: projectPlayerView(before, "RAVEN"), afterView: projectPlayerView(after, "RAVEN"),
      lockedIntents: [billIntent, ravenIntent], persistedResolutions: [], visibleOperations: [], visibleEvents: [],
      toneSettings: { style: "grounded", contentLimits: [] },
      narrativeBrief: { summary: "Visible events occur.", requiredResolutionIds: [], requiredEventIds: [] },
    };
  }

  test.each([
    { viewer: undefined, expected: ["test_public", "test_party", "test_raven"] },
    { viewer: "RAVEN" as const, expected: ["test_public", "test_party", "test_raven"] },
    { viewer: "BILL" as const, expected: ["test_public", "test_party", "test_bill"] },
  ])("only permits PUBLIC, PARTY and the explicit/default viewer ($viewer)", ({ viewer, expected }) => {
    const state = WorldStateSchema.parse({ ...minimumWorldStateInput, events: [{ id: "test_event", audience: "PUBLIC", kind: "notice", text: "A bell rings." }] });
    const raw = request(state);
    const visibleOperations: WorldOperation[] = (["PUBLIC", "PARTY", "RAVEN", "BILL", "DIRECTOR"] as const).map((audience) => ({
      id: `test_${audience.toLowerCase()}`, kind: "ADD_EVENT", audience, reason: "SENTINEL_REASON", cause,
      event: { id: "test_event", audience: "DIRECTOR", kind: "secret", text: "SENTINEL_PAYLOAD" },
    }));
    const result = buildNarratorInput({ ...raw, ...(viewer ? { viewer } : {}), visibleOperations });
    expect(result.visibleOperations.map(({ id }) => id)).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
  });

  test("rebuilds each supported operation from resolved values and omits unprojected IDs", () => {
    const before = WorldStateSchema.parse({
      ...minimumWorldStateInput,
      actors: { ...minimumWorldStateInput.actors, test_actor_raven: { ...minimumWorldStateInput.actors.test_actor_raven,
        conditions: ["Prone"], resources: {
          test_spend: { id: "test_spend", name: "Focus", current: 4, maximum: 6 },
          test_restore: { id: "test_restore", name: "Luck", current: 1, maximum: 6 },
        } } },
      inventory: { test_old: { id: "test_old", name: "Old key", ownerActorId: "test_actor_raven", containerId: null, quantity: 1, equippedSlots: [], facts: [] } },
    });
    const after = WorldStateSchema.parse({ ...before,
      actors: { ...before.actors, test_actor_raven: { ...before.actors.test_actor_raven, currentHp: 8, temporaryHp: 2, conditions: ["Blessed"],
        resources: {
          test_spend: { id: "test_spend", name: "Focus", current: 2, maximum: 6 },
          test_restore: { id: "test_restore", name: "Luck", current: 4, maximum: 6 },
        } } },
      inventory: { test_key: { id: "test_key", name: "Key", ownerActorId: "test_actor_raven", containerId: null, quantity: 1, equippedSlots: ["Belt"], facts: [] } },
      npcs: { test_npc: { id: "test_npc", audience: "PUBLIC", name: "Guide", status: "Friendly", facts: [] } },
      quests: { test_quest: { id: "test_quest", audience: "PUBLIC", name: "Trail", status: "Complete", facts: [] } },
      clocks: { test_clock: { id: "test_clock", audience: "PUBLIC", name: "Dusk", status: "Advancing", current: 2, maximum: 6, facts: [] } },
      facts: [{ id: "test_fact", audience: "PUBLIC", kind: "sign", text: "A safe mark" }],
      combat: { id: "test_combat", round: 2, currentActorId: "test_actor_raven", initiativeOrder: ["test_actor_raven", "test_hidden_actor"], facts: [{ id: "test_hidden_combat_fact", audience: "DIRECTOR", kind: "secret", text: "SENTINEL_COMBAT" }] },
    });
    type Payload = WorldOperation extends infer O ? O extends WorldOperation ? Omit<O, "id" | "audience" | "cause" | "reason"> : never : never;
    const payloads: Payload[] = [
      { kind: "SET_HP", actorId: "test_actor_raven", value: 999 },
      { kind: "SET_TEMP_HP", actorId: "test_actor_raven", value: 999 },
      { kind: "SPEND_RESOURCE", actorId: "test_actor_raven", resourceId: "test_spend", amount: 999 },
      { kind: "RESTORE_RESOURCE", actorId: "test_actor_raven", resourceId: "test_restore", amount: 999 },
      { kind: "ADD_CONDITION", actorId: "test_actor_raven", condition: "Blessed" },
      { kind: "REMOVE_CONDITION", actorId: "test_actor_raven", condition: "Prone" },
      { kind: "MOVE_ACTOR", actorId: "test_actor_raven", locationId: "test_location" },
      { kind: "ADD_INVENTORY", item: { ...after.inventory.test_key!, facts: [{ id: "test_hidden", audience: "DIRECTOR", kind: "secret", text: "SENTINEL_INVENTORY" }] } },
      { kind: "REMOVE_INVENTORY", itemId: "test_old" },
      { kind: "SET_EQUIPPED", itemId: "test_key", slots: ["SENTINEL_SLOTS"] },
      { kind: "ADD_FACT", fact: { id: "test_fact", audience: "DIRECTOR", kind: "secret", text: "SENTINEL_FACT" } },
      { kind: "ADVANCE_CLOCK", clockId: "test_clock", amount: 999 },
      { kind: "SET_NPC_ATTITUDE", npcId: "test_npc", status: "SENTINEL_NPC" },
      { kind: "SET_QUEST_STATUS", questId: "test_quest", status: "SENTINEL_QUEST" },
      { kind: "SET_COMBAT", combat: { id: "test_combat", hidden: "SENTINEL_UNKNOWN" } },
      { kind: "ADVANCE_INITIATIVE" },
      { kind: "SET_DECISION", decision: { id: after.currentDecision.id, hidden: "SENTINEL_DECISION" } },
      { kind: "SET_FLAG", flag: { id: "test_hidden_flag", audience: "DIRECTOR", key: "secret", text: "SENTINEL_FLAG" } },
      { kind: "SET_HP", actorId: "test_hidden_actor", value: 999 },
      { kind: "SPEND_RESOURCE", actorId: "test_actor_bill", resourceId: "test_hidden_resource", amount: 999 },
      { kind: "MOVE_ACTOR", actorId: "test_actor_raven", locationId: "test_hidden_location" },
      { kind: "ADD_CONDITION", actorId: "test_actor_raven", condition: "SENTINEL_HIDDEN_CONDITION" },
    ];
    const operations = payloads.map((payload, i) => ({ ...payload, id: `test_op_${i}`, audience: "PUBLIC", cause, reason: "SENTINEL_REASON" })) as WorldOperation[];
    const result = buildNarratorInput({ ...request(before, after), visibleOperations: operations });
    expect(result.visibleOperations).toHaveLength(17);
    expect(result.visibleOperations.slice(0, 4)).toEqual([
      { id: "test_op_0", kind: "SET_HP", actorId: "test_actor_raven", value: 8 },
      { id: "test_op_1", kind: "SET_TEMP_HP", actorId: "test_actor_raven", value: 2 },
      { id: "test_op_2", kind: "SPEND_RESOURCE", actorId: "test_actor_raven", resourceId: "test_spend", current: 2, amount: 2 },
      { id: "test_op_3", kind: "RESTORE_RESOURCE", actorId: "test_actor_raven", resourceId: "test_restore", current: 4, amount: 3 },
    ]);
    expect(result.visibleOperations[9]).toEqual({ id: "test_op_9", kind: "SET_EQUIPPED", itemId: "test_key", slots: ["Belt"] });
    expect(result.visibleOperations[10]).toEqual({ id: "test_op_10", kind: "ADD_FACT", fact: { id: "test_fact", kind: "sign", text: "A safe mark" } });
    expect(result.visibleOperations[11]).toEqual({ id: "test_op_11", kind: "ADVANCE_CLOCK", clockId: "test_clock", current: 2, maximum: 6 });
    expect(result.visibleOperations[12]).toEqual({ id: "test_op_12", kind: "SET_NPC_ATTITUDE", npcId: "test_npc", status: "Friendly" });
    expect(result.visibleOperations[13]).toEqual({ id: "test_op_13", kind: "SET_QUEST_STATUS", questId: "test_quest", status: "Complete" });
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
    expect(JSON.stringify(result)).not.toContain("test_hidden");
  });

  test("rebuilds public and viewer operations from projections instead of trusting nested payloads", () => {
    const before = WorldStateSchema.parse({
      ...minimumWorldStateInput,
      actors: {
        ...minimumWorldStateInput.actors,
        test_actor_raven: {
          ...minimumWorldStateInput.actors.test_actor_raven,
          scopedNotes: [{ id: "test_note_raven", audience: "RAVEN", text: "SENTINEL_RAVEN_MEMORY" }],
        },
      },
    });
    const after = WorldStateSchema.parse({
      ...before,
      inventory: {
        test_item_raven: {
          id: "test_item_raven", name: "Safe key", ownerActorId: "test_actor_raven", containerId: null, quantity: 1,
          equippedSlots: [],
          facts: [{ id: "test_hidden_fact", audience: "DIRECTOR", kind: "secret", text: "SENTINEL_NESTED_INVENTORY_FACT" }],
        },
      },
      events: [{ id: "test_event_raven", audience: "RAVEN", kind: "discovery", text: "Raven sees a safe sign." }],
    });
    const operations: WorldOperation[] = [
      {
        id: "test_operation_inventory", kind: "ADD_INVENTORY", audience: "PUBLIC",
        reason: "SENTINEL_RAW_OPERATION_REASON",
        cause: { type: "SYSTEM", systemRule: "TIME" },
        item: {
          id: "test_item_raven", name: "Safe key", ownerActorId: "test_actor_raven", containerId: null, quantity: 1,
          equippedSlots: [],
          facts: [{ id: "test_hidden_fact", audience: "DIRECTOR", kind: "secret", text: "SENTINEL_NESTED_INVENTORY_FACT" }],
        },
      },
      {
        id: "test_operation_hidden_event", kind: "ADD_EVENT", audience: "PUBLIC",
        reason: "Public wrapper", cause: { type: "SYSTEM", systemRule: "TIME" },
        event: { id: "test_hidden_event", audience: "DIRECTOR", kind: "betrayal", text: "SENTINEL_NESTED_EVENT" },
      },
      {
        id: "test_operation_raven_event", kind: "ADD_EVENT", audience: "RAVEN",
        reason: "SENTINEL_RAVEN_OPERATION_REASON", cause: { type: "SYSTEM", systemRule: "TIME" },
        event: { id: "test_event_raven", audience: "DIRECTOR", kind: "secret", text: "SENTINEL_FALSE_PUBLIC_PAYLOAD" },
      },
      {
        id: "test_operation_unknown_combat", kind: "SET_COMBAT", audience: "PUBLIC",
        reason: "SENTINEL_COMBAT_REASON", cause: { type: "SYSTEM", systemRule: "INITIATIVE" },
        combat: { hidden: "SENTINEL_UNKNOWN_COMBAT_PAYLOAD" },
      },
      {
        id: "test_operation_unknown_decision", kind: "SET_DECISION", audience: "DIRECTOR",
        reason: "SENTINEL_DIRECTOR_OPERATION", cause: { type: "SYSTEM", systemRule: "CHECKPOINT" },
        decision: { hidden: "SENTINEL_UNKNOWN_DECISION_PAYLOAD" },
      },
    ];
    const rawInput: NarratorBuildInput & { rawSourceText: string } = {
      viewer: "RAVEN",
      beforeView: projectPlayerView(before, "RAVEN"),
      afterView: projectPlayerView(after, "RAVEN"),
      lockedIntents: [billIntent, ravenIntent],
      persistedPlan: null,
      persistedResolutions: [],
      visibleOperations: operations,
      visibleEvents: [{ id: "test_event_raven" }],
      toneSettings: { style: "grounded", contentLimits: [] },
      narrativeBrief: { summary: "Raven finds a safe key.", requiredResolutionIds: [], requiredEventIds: ["test_event_raven"] },
      rawSourceText: "SENTINEL_RAW_SOURCE_TEXT",
    };

    const output = buildNarratorInput(rawInput);
    const serialized = JSON.stringify(output);

    expect(output.visibleOperations).toEqual([
      expect.objectContaining({ kind: "ADD_INVENTORY", item: expect.objectContaining({ id: "test_item_raven", facts: [] }) }),
      { id: "test_operation_raven_event", kind: "ADD_EVENT", event: { id: "test_event_raven", kind: "discovery", text: "Raven sees a safe sign." } },
    ]);
    for (const sentinel of [
      "SENTINEL_RAVEN_MEMORY",
      "SENTINEL_RAW_OPERATION_REASON",
      "SENTINEL_NESTED_INVENTORY_FACT",
      "SENTINEL_NESTED_EVENT",
      "SENTINEL_RAVEN_OPERATION_REASON",
      "SENTINEL_FALSE_PUBLIC_PAYLOAD",
      "SENTINEL_COMBAT_REASON",
      "SENTINEL_UNKNOWN_COMBAT_PAYLOAD",
      "SENTINEL_DIRECTOR_OPERATION",
      "SENTINEL_UNKNOWN_DECISION_PAYLOAD",
      "SENTINEL_RAW_SOURCE_TEXT",
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
    expect(output.beforeView.actors.every((actor) => !("scopedNotes" in actor))).toBe(true);
    expect(output.afterView.actors.every((actor) => !("scopedNotes" in actor))).toBe(true);
  });
});
