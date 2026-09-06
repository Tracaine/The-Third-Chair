import { expect, test, vi } from "vitest";
import { type WorldOperation, type CheckResolution } from "@third-chair/contracts";
import * as agents from "../src/index.js";
import { directorInput, proposal, sourcePack, usage } from "./director-fixtures.js";

function adapter(output = proposal()) {
  const run = vi.fn(async () => ({ finalOutput: output, usage }));
  return { run, director: new agents.OpenAiDirectorAdapter({ config: agents.loadAgentConfig({}), sourcePack, runClient: { run } }) };
}
const base = { id: "test_operation", audience: "PUBLIC" as const, reason: "Adjudication", cause: { type: "UNCONTESTED" as const, intentActorId: "test_actor_bill" } };

test.each(["BILL", "RAVEN"])("stops before model execution when required %s intent is missing", async (seat) => {
  const { director, run } = adapter();
  const input = directorInput(); input.intents = input.intents.filter((intent) => intent.seat !== seat);
  await expect(director.propose(input)).rejects.toThrow(/^DIRECTOR_MISSING_INTENT$/);
  expect(run).not.toHaveBeenCalled();
});

test.each(["wrong controller", "duplicate actor", "ineligible actor"])("rejects %s locked intent authority", async (kind) => {
  const { director, run } = adapter(); const input = directorInput();
  if (kind === "wrong controller") input.intents[0]!.seat = "RAVEN";
  if (kind === "duplicate actor") input.intents.push(input.intents[0]!);
  if (kind === "ineligible actor") input.state.currentDecision.eligibleActorIds = ["test_actor_raven"];
  await expect(director.propose(input)).rejects.toThrow(/^DIRECTOR_INTENT_AUTHORITY_VIOLATION$/);
  expect(run).not.toHaveBeenCalled();
});

test("requires exact locked authority for player action, not a substring", async () => {
  const output = proposal();
  output.uncontestedOperations.push({ ...base, kind: "ADD_EVENT", intentActorId: "test_actor_bill",
    event: { id: "test_event", audience: "PUBLIC", kind: "action", text: "Open the door and surrender" } });
  await expect(adapter(output).director.propose(directorInput())).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  (output.uncontestedOperations[0] as Extract<WorldOperation, { kind: "ADD_EVENT" }>).event.text = "Open the door";
  expect(await adapter(output).director.propose(directorInput())).toEqual(output);
});

test("identifies the exact player-authority operation for bounded repair", async () => {
  const output = proposal();
  output.checkLinkedOperations.push({ ...base, kind: "ADD_EVENT", intentActorId: "test_actor_bill",
    cause: { type: "RESOLUTION", resolutionId: "test_resolution", allowedOutcomeTiers: ["SUCCESS"] },
    event: { id: "test_event", audience: "PUBLIC", kind: "action", text: "Bill forces the door." } });
  const input = { ...directorInput(), persistedResolutions: [{
    id: "test_resolution", planId: "test_plan", actorId: "test_actor_bill", checkKind: "ability", key: "strength",
    naturalDice: [14], keptDie: 14, modifier: 0, total: 14, target: 10, tier: "SUCCESS", visibility: "PUBLIC",
    advantage: "NORMAL", advantageReason: "None", successStakes: "Opens", failureStakes: "Time passes",
    citations: [], startingCounter: 0, endingCounter: 1,
  } satisfies CheckResolution] };

  await expect(adapter(output).director.propose(input)).rejects.toMatchObject({
    issues: [{ path: "/checkLinkedOperations/0", message: "DIRECTOR_PLAYER_AUTHORITY_VIOLATION" }],
  });
});

test.each(["dialogue", "thought", "consent", "reaction", "resource_commitment", "feeling"])("locked action text cannot authorize player %s modality", async (kind) => {
  for (const actorId of ["test_actor_bill", "test_actor_raven"]) {
    const output = proposal(); output.uncontestedOperations.push({ ...base, kind: "ADD_EVENT", intentActorId: actorId,
      cause: { type: "UNCONTESTED", intentActorId: actorId },
      event: { id: "test_event", audience: "PUBLIC", kind, text: "Open the door" } });
    await expect(adapter(output).director.propose(directorInput())).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  }
});

test("unbound agency events fail closed but controller-bound NPC dialogue remains legitimate", async () => {
  const output = proposal();
  output.uncontestedOperations.push({ ...base, kind: "ADD_EVENT", event: { id: "test_event", audience: "PUBLIC", kind: "dialogue", text: "Bill, you may enter." } });
  await expect(adapter(output).director.propose(directorInput())).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  const input = directorInput();
  input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  (output.uncontestedOperations[0] as Extract<WorldOperation, { kind: "ADD_EVENT" }>).intentActorId = "test_npc";
  output.uncontestedOperations[0]!.cause = { type: "UNCONTESTED", intentActorId: "test_npc" };
  expect(await adapter(output).director.propose(input)).toEqual(output);
});

test.each(["actor", "npc record"])("uncontested NPC agency uses its own %s authority", async (representation) => {
  const input = directorInput(); input.intents = []; input.state.currentDecision.owner = "DIRECTOR";
  if (representation === "actor") input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  else input.state.npcs.test_npc = { id: "test_npc", audience: "PUBLIC", name: "Gatekeeper", status: "Friendly", facts: [] };
  const output = proposal(); output.uncontestedOperations.push({ ...base, kind: "ADD_EVENT", intentActorId: "test_npc",
    cause: { type: "UNCONTESTED", intentActorId: "test_npc" },
    event: { id: "test_event", audience: "PUBLIC", kind: "dialogue", text: "Bill, you may enter." } });
  expect(await adapter(output).director.propose(input)).toEqual(output);
});

test.each(["ADD_EVENT", "MOVE_ACTOR"] as const)("NPC %s cannot borrow a locked player intent", async (kind) => {
  const input = directorInput();
  input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  const output = proposal(); output.uncontestedOperations.push(kind === "ADD_EVENT"
    ? { ...base, kind, intentActorId: "test_npc", event: { id: "test_event", audience: "PUBLIC", kind: "action", text: "The gatekeeper opens the gate." } }
    : { ...base, kind, actorId: "test_npc", locationId: "test_location" });
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  output.uncontestedOperations[0]!.cause = { type: "UNCONTESTED", intentActorId: "test_npc" };
  expect(await adapter(output).director.propose(input)).toEqual(output);
});

test("requires player destination to be explicitly targeted", async () => {
  for (const operation of [
    { ...base, kind: "MOVE_ACTOR" as const, actorId: "test_actor_bill", locationId: "test_destination" },
  ]) {
    const output = proposal(); output.uncontestedOperations.push(operation);
    await expect(adapter(output).director.propose(directorInput())).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
    const input = directorInput(); input.intents[0]!.committedResourceIds = ["test_resource"]; input.intents[0]!.targetIds = ["test_destination"];
    expect(await adapter(output).director.propose(input)).toEqual(output);
    input.intents[0]!.mode = "DEFER";
    await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  }
});

test("every resolution cause must reference a supplied result with its actual outcome tier", async () => {
  const output = proposal(); output.checkLinkedOperations.push({ ...base, kind: "ADVANCE_CLOCK", clockId: "test_clock", amount: 1,
    cause: { type: "RESOLUTION", resolutionId: "test_resolution", allowedOutcomeTiers: ["SUCCESS"] } });
  await expect(adapter(output).director.propose(directorInput())).rejects.toThrow(/^DIRECTOR_UNKNOWN_RESOLUTION$/);
  const input = { ...directorInput(), persistedResolutions: [{
    id: "test_resolution", planId: "test_plan", actorId: "test_actor_bill", checkKind: "ability", key: "strength",
    naturalDice: [14], keptDie: 14, modifier: 0, total: 14, target: 10, tier: "SUCCESS", visibility: "PUBLIC",
    advantage: "NORMAL", advantageReason: "None", successStakes: "Opens", failureStakes: "Time passes", citations: [], startingCounter: 0, endingCounter: 1,
  } satisfies CheckResolution] };
  expect(await adapter(output).director.propose(input)).toEqual(output);
  input.persistedResolutions[0]!.tier = "FAILURE" as "SUCCESS";
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_OUTCOME_TIER_MISMATCH$/);
});

test("check-linked operations cannot evade resolution validation via an uncontested cause", async () => {
  const output = proposal(); output.checkLinkedOperations.push({ ...base, kind: "ADVANCE_CLOCK", clockId: "test_clock", amount: 1 });
  await expect(adapter(output).director.propose(directorInput())).rejects.toThrow(/^DIRECTOR_UNKNOWN_RESOLUTION$/);
});

test("a Director-owned world beat needs no fabricated player intent", async () => {
  const input = directorInput(); input.state.currentDecision.owner = "DIRECTOR"; input.intents = [];
  expect(await adapter().director.propose(input)).toEqual(proposal());
});

test("REMOVE_INVENTORY requires the owner's explicitly committed item ID", async () => {
  const input = directorInput();
  input.state.inventory.test_item = { id: "test_item", name: "Potion", ownerActorId: "test_actor_bill", containerId: null,
    quantity: 1, equippedSlots: [], facts: [] };
  const output = proposal();
  output.uncontestedOperations.push({ ...base, kind: "REMOVE_INVENTORY", itemId: "test_item" });
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  input.intents[0]!.committedResourceIds = ["test_item"]; input.intents[0]!.targetIds = ["test_item"];
  expect(await adapter(output).director.propose(input)).toEqual(output);
  input.intents[0]!.committedResourceIds = ["test_other_item"];
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
});

test.each([1, 2, 1000])("a committed resource ID cannot authorize player SPEND_RESOURCE amount %s", async (amount) => {
  for (const actorId of ["test_actor_bill", "test_actor_raven"]) {
    const input = directorInput(); input.intents.find((intent) => intent.actorId === actorId)!.committedResourceIds = ["test_resource"];
    for (const cause of [{ type: "UNCONTESTED" as const, intentActorId: actorId }, { type: "SYSTEM" as const, systemRule: "TIME" as const }]) {
      const output = proposal(); output.uncontestedOperations.push({ ...base, cause, kind: "SPEND_RESOURCE", actorId, resourceId: "test_resource", amount });
      await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
    }
  }
});

test.each([{ slots: [] }, { slots: ["hand"] }, { slots: ["head", "hand"] }])("target/commit IDs cannot authorize player SET_EQUIPPED $slots", async ({ slots }) => {
  for (const actorId of ["test_actor_bill", "test_actor_raven"]) {
    const input = directorInput();
    input.state.inventory.test_item = { id: "test_item", name: "Item", ownerActorId: actorId, containerId: null, quantity: 1, equippedSlots: [], facts: [] };
    const intent = input.intents.find((intent) => intent.actorId === actorId)!;
    intent.targetIds = ["test_item"]; intent.committedResourceIds = ["test_item"];
    const output = proposal(); output.uncontestedOperations.push({ ...base, kind: "SET_EQUIPPED", itemId: "test_item", slots,
      cause: { type: "UNCONTESTED", intentActorId: actorId } });
    await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  }
});

test.each(["test_actor_bill", "test_actor_raven"])("ADD_INVENTORY cannot pre-equip an item for %s but permits unequipped receipt", async (actorId) => {
  const input = directorInput();
  const intent = input.intents.find((intent) => intent.actorId === actorId)!;
  intent.targetIds = ["test_item"]; intent.committedResourceIds = ["test_item"];
  const output = proposal();
  const operation: Extract<WorldOperation, { kind: "ADD_INVENTORY" }> = { ...base, kind: "ADD_INVENTORY",
    cause: { type: "UNCONTESTED", intentActorId: actorId },
    item: { id: "test_item", name: "Item", ownerActorId: actorId, containerId: null, quantity: 1, equippedSlots: ["hand"], facts: [] } };
  output.uncontestedOperations.push(operation);
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  operation.item.equippedSlots = [];
  expect(await adapter(output).director.propose(input)).toEqual(output);
});

test.each(["test_actor_bill", "test_actor_raven"])("unequipped NPC inventory cannot borrow %s authority", async (actorId) => {
  const input = directorInput();
  input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  const output = proposal();
  const operation: Extract<WorldOperation, { kind: "ADD_INVENTORY" }> = { ...base, kind: "ADD_INVENTORY",
    cause: { type: "UNCONTESTED", intentActorId: actorId },
    item: { id: "test_item", name: "Item", ownerActorId: "test_npc", containerId: null, quantity: 1, equippedSlots: [], facts: [] } };
  output.uncontestedOperations.push(operation);
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  operation.cause = { type: "UNCONTESTED", intentActorId: "test_npc" };
  expect(await adapter(output).director.propose(input)).toEqual(output);
});

test.each(["test_actor_bill", "test_actor_raven"])("a proposed player inventory item cannot be equipped later in the same proposal for %s", async (actorId) => {
  const input = directorInput();
  const output = proposal();
  output.uncontestedOperations.push(
    { ...base, id: "test_add", cause: { type: "SYSTEM", systemRule: "TIME" }, kind: "ADD_INVENTORY",
      item: { id: "test_item", name: "Item", ownerActorId: actorId, containerId: null, quantity: 1, equippedSlots: [], facts: [] } },
    { ...base, id: "test_equip", cause: { type: "UNCONTESTED", intentActorId: actorId }, kind: "SET_EQUIPPED", itemId: "test_item", slots: ["hand"] },
  );
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
});

test.each(["test_actor_bill", "test_actor_raven"])("a proposed player inventory item cannot be removed later without %s's commitment", async (actorId) => {
  const input = directorInput();
  const output = proposal();
  output.uncontestedOperations.push(
    { ...base, id: "test_add", cause: { type: "SYSTEM", systemRule: "TIME" }, kind: "ADD_INVENTORY",
      item: { id: "test_item", name: "Item", ownerActorId: actorId, containerId: null, quantity: 1, equippedSlots: [], facts: [] } },
    { ...base, id: "test_remove", cause: { type: "UNCONTESTED", intentActorId: actorId }, kind: "REMOVE_INVENTORY", itemId: "test_item" },
  );
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
});

test.each(["SET_EQUIPPED", "REMOVE_INVENTORY"] as const)("a proposed NPC item cannot borrow player authority for a later %s", async (kind) => {
  const input = directorInput();
  input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  const output = proposal();
  output.uncontestedOperations.push(
    { ...base, id: "test_add", cause: { type: "UNCONTESTED", intentActorId: "test_npc" }, kind: "ADD_INVENTORY",
      item: { id: "test_item", name: "Item", ownerActorId: "test_npc", containerId: null, quantity: 1, equippedSlots: [], facts: [] } },
    kind === "SET_EQUIPPED"
      ? { ...base, id: "test_followup", kind, itemId: "test_item", slots: ["hand"] }
      : { ...base, id: "test_followup", kind, itemId: "test_item" },
  );
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
});

test.each([
  { collision: "existing-state", kind: "SET_EQUIPPED" as const },
  { collision: "existing-state", kind: "REMOVE_INVENTORY" as const },
  { collision: "same-proposal", kind: "SET_EQUIPPED" as const },
  { collision: "same-proposal", kind: "REMOVE_INVENTORY" as const },
])("rejects $collision inventory ID collision before later $kind laundering", async ({ collision, kind }) => {
  const input = directorInput();
  input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  if (collision === "existing-state") {
    input.state.inventory.test_item = { id: "test_item", name: "Bill's item", ownerActorId: "test_actor_bill",
      containerId: null, quantity: 1, equippedSlots: [], facts: [] };
  }
  const output = proposal();
  if (collision === "same-proposal") {
    output.uncontestedOperations.push({ ...base, id: "test_player_add", cause: { type: "SYSTEM", systemRule: "TIME" },
      kind: "ADD_INVENTORY",
      item: { id: "test_item", name: "Bill's item", ownerActorId: "test_actor_bill", containerId: null,
        quantity: 1, equippedSlots: [], facts: [] } });
  }
  output.uncontestedOperations.push(
    { ...base, id: "test_npc_add", cause: { type: "UNCONTESTED", intentActorId: "test_npc" },
      kind: "ADD_INVENTORY",
      item: { id: "test_item", name: "NPC item", ownerActorId: "test_npc", containerId: null,
        quantity: 1, equippedSlots: [], facts: [] } },
    kind === "SET_EQUIPPED"
      ? { ...base, id: "test_launder", cause: { type: "UNCONTESTED", intentActorId: "test_npc" },
          kind, itemId: "test_item", slots: ["hand"] }
      : { ...base, id: "test_launder", cause: { type: "UNCONTESTED", intentActorId: "test_npc" },
          kind, itemId: "test_item" },
  );
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
});

test.each(["NPC", "SYSTEM"])("safe %s grants may add an unequipped item to player inventory", async (authority) => {
  const input = directorInput();
  input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  const output = proposal();
  output.uncontestedOperations.push({ ...base, kind: "ADD_INVENTORY",
    cause: authority === "NPC" ? { type: "UNCONTESTED", intentActorId: "test_npc" } : { type: "SYSTEM", systemRule: "TIME" },
    item: { id: "test_item", name: "Item", ownerActorId: "test_actor_bill", containerId: null, quantity: 1, equippedSlots: [], facts: [] } });
  expect(await adapter(output).director.propose(input)).toEqual(output);
});

test.each(["UNCONTESTED", "SYSTEM"])("NPC resource/equipment changes preserve legitimate %s authority", async (type) => {
  const input = directorInput(); input.intents = []; input.state.currentDecision.owner = "DIRECTOR";
  input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  input.state.inventory.test_item = { id: "test_item", name: "Item", ownerActorId: "test_npc", containerId: null, quantity: 1, equippedSlots: [], facts: [] };
  const cause = type === "UNCONTESTED" ? { type: "UNCONTESTED" as const, intentActorId: "test_npc" }
    : { type: "SYSTEM" as const, systemRule: "TIME" as const };
  const output = proposal(); output.uncontestedOperations.push(
    { ...base, cause, kind: "SPEND_RESOURCE", actorId: "test_npc", resourceId: "test_resource", amount: 1 },
    { ...base, cause, kind: "SET_EQUIPPED", itemId: "test_item", slots: ["hand"] },
    { ...base, cause, kind: "ADD_INVENTORY", item: { id: "test_new_item", name: "New item", ownerActorId: "test_npc", containerId: null, quantity: 1, equippedSlots: ["head"], facts: [] } },
  );
  expect(await adapter(output).director.propose(input)).toEqual(output);
});

test.each(["SET_EQUIPPED", "ADD_INVENTORY", "REMOVE_INVENTORY"] as const)("NPC %s inventory action cannot borrow player authority", async (kind) => {
  const input = directorInput();
  input.state.actors.test_npc = { ...input.state.actors.test_actor_bill!, controller: "DIRECTOR", name: "Gatekeeper" };
  const item = { id: "test_item", name: "Item", ownerActorId: "test_npc", containerId: null, quantity: 1, equippedSlots: ["hand"], facts: [] };
  if (kind !== "ADD_INVENTORY") input.state.inventory.test_item = item;
  const output = proposal(); output.uncontestedOperations.push(kind === "SET_EQUIPPED"
    ? { ...base, kind, itemId: "test_item", slots: ["head"] }
    : kind === "REMOVE_INVENTORY" ? { ...base, kind, itemId: "test_item" } : { ...base, kind, item });
  await expect(adapter(output).director.propose(input)).rejects.toThrow(/^DIRECTOR_PLAYER_AUTHORITY_VIOLATION$/);
  output.uncontestedOperations[0]!.cause = { type: "UNCONTESTED", intentActorId: "test_npc" };
  expect(await adapter(output).director.propose(input)).toEqual(output);
});

test("the narrative brief cannot cite a fabricated persisted resolution", async () => {
  const output = proposal(); output.narrativeBrief.requiredResolutionIds = ["test_fabricated_resolution"];
  await expect(adapter(output).director.propose(directorInput())).rejects.toThrow(/^DIRECTOR_UNKNOWN_RESOLUTION$/);
});
