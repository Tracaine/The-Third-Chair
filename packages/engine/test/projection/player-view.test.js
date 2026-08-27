import { describe, expect, test } from "vitest";
import { WorldStateSchema } from "@third-chair/contracts";
import { projectPlayerView } from "@third-chair/engine";
import { minimumWorldStateInput } from "../../../contracts/test/fixtures.js";
const stateWithScopedKnowledge = WorldStateSchema.parse({
    ...minimumWorldStateInput,
    actors: {
        ...minimumWorldStateInput.actors,
        test_actor_bill: {
            ...minimumWorldStateInput.actors.test_actor_bill,
            resources: { test_resource_bill: { id: "test_resource_bill", name: "Second Wind", current: 1, maximum: 1 } },
            scopedNotes: [
                { id: "test_note_bill", audience: "BILL", text: "SENTINEL_BILL_MEMORY" },
            ],
        },
        test_actor_raven: {
            ...minimumWorldStateInput.actors.test_actor_raven,
            scopedNotes: [{ id: "test_note_raven", audience: "RAVEN", text: "SENTINEL_RAVEN_MEMORY" }],
        },
    },
    clocks: {
        test_clock_director: {
            id: "test_clock_director",
            audience: "DIRECTOR",
            name: "SENTINEL_DIRECTOR_CLOCK",
            status: "Advancing",
            current: 1,
            maximum: 6,
            facts: [],
        },
    },
    currentDecision: {
        ...minimumWorldStateInput.currentDecision,
        owner: "BILL",
        constraints: "Bill-only constraint",
        requiredInput: "Bill-only input",
        legalOptions: ["Bill-only option"],
    },
});
describe("projectPlayerView", () => {
    test("selects only the viewer's scoped records", () => {
        const billJson = JSON.stringify(projectPlayerView(stateWithScopedKnowledge, "BILL"));
        const ravenJson = JSON.stringify(projectPlayerView(stateWithScopedKnowledge, "RAVEN"));
        expect(billJson).not.toContain("SENTINEL_DIRECTOR_CLOCK");
        expect(billJson).not.toContain("SENTINEL_RAVEN_MEMORY");
        expect(ravenJson).not.toContain("SENTINEL_BILL_MEMORY");
        expect(ravenJson).toContain("SENTINEL_RAVEN_MEMORY");
    });
    test("shows a non-owner who owns the next decision without its instructions", () => {
        const ravenView = projectPlayerView(stateWithScopedKnowledge, "RAVEN");
        expect(ravenView.currentDecision).toMatchObject({
            id: "test_decision",
            owner: "BILL",
            situation: "A closed door blocks the way.",
        });
        expect(ravenView.currentDecision).not.toHaveProperty("eligibleActorIds");
        expect(ravenView.currentDecision).not.toHaveProperty("constraints");
        expect(ravenView.currentDecision).not.toHaveProperty("requiredInput");
        expect(ravenView.currentDecision).not.toHaveProperty("legalOptions");
    });
    test("shows the viewer's permitted resources but not another actor's private resources", () => {
        const billView = projectPlayerView(stateWithScopedKnowledge, "BILL");
        const ravenView = projectPlayerView(stateWithScopedKnowledge, "RAVEN");
        expect(billView.actors.find((actor) => actor.id === "test_actor_bill")).toHaveProperty("resources");
        expect(ravenView.actors.find((actor) => actor.id === "test_actor_bill")).not.toHaveProperty("resources");
    });
    test("fails closed for unowned and another controller's inventory while severing hidden containers", () => {
        const state = WorldStateSchema.parse({
            ...minimumWorldStateInput,
            actors: {
                ...minimumWorldStateInput.actors,
                test_actor_director: { ...minimumWorldStateInput.actors.test_actor_bill, controller: "DIRECTOR", name: "Director actor" },
            },
            inventory: {
                test_item_bill: {
                    id: "test_item_bill", name: "Bill's map", ownerActorId: "test_actor_bill", containerId: "test_item_raven",
                    quantity: 1, equippedSlots: [], facts: [],
                },
                test_item_raven: {
                    id: "test_item_raven", name: "Raven's pouch", ownerActorId: "test_actor_raven", containerId: null,
                    quantity: 1, equippedSlots: [], facts: [],
                },
                test_item_unowned: {
                    id: "test_item_unowned", name: "SENTINEL_UNOWNED_ITEM", ownerActorId: null, containerId: null,
                    quantity: 1, equippedSlots: [], facts: [],
                },
                test_item_director: {
                    id: "test_item_director", name: "SENTINEL_DIRECTOR_ITEM", ownerActorId: "test_actor_director", containerId: null,
                    quantity: 1, equippedSlots: [], facts: [],
                },
            },
        });
        const billView = projectPlayerView(state, "BILL");
        const ravenView = projectPlayerView(state, "RAVEN");
        expect(billView.inventory).toEqual([expect.objectContaining({ id: "test_item_bill", containerId: null })]);
        expect(ravenView.inventory).toEqual([expect.objectContaining({ id: "test_item_raven", containerId: null })]);
        expect(JSON.stringify(billView)).not.toContain("SENTINEL_UNOWNED_ITEM");
        expect(JSON.stringify(ravenView)).not.toContain("SENTINEL_UNOWNED_ITEM");
        expect(JSON.stringify(billView)).not.toContain("SENTINEL_DIRECTOR_ITEM");
        expect(JSON.stringify(ravenView)).not.toContain("SENTINEL_DIRECTOR_ITEM");
    });
    test("keeps only selected combat initiative and current actor IDs", () => {
        const state = WorldStateSchema.parse({
            ...minimumWorldStateInput,
            actors: {
                ...minimumWorldStateInput.actors,
                test_actor_director: { ...minimumWorldStateInput.actors.test_actor_bill, controller: "DIRECTOR", name: "Director actor" },
            },
            npcs: {
                test_npc_visible: { id: "test_npc_visible", audience: "PUBLIC", name: "Visible foe", status: "Hostile", facts: [] },
            },
            combat: {
                id: "test_combat", round: 1, currentActorId: "test_actor_director",
                initiativeOrder: ["test_actor_bill", "test_npc_visible", "test_actor_director"], facts: [],
            },
        });
        const visibleCurrentState = WorldStateSchema.parse({
            ...state,
            combat: { ...state.combat, currentActorId: "test_npc_visible" },
        });
        const hiddenCurrent = projectPlayerView(state, "BILL");
        const visibleCurrent = projectPlayerView(visibleCurrentState, "BILL");
        expect(hiddenCurrent.combat).toMatchObject({
            initiativeOrder: ["test_actor_bill", "test_npc_visible"], currentActorId: null,
        });
        expect(JSON.stringify(hiddenCurrent)).not.toContain("test_actor_director");
        expect(visibleCurrent.combat).toMatchObject({ currentActorId: "test_npc_visible" });
    });
});
//# sourceMappingURL=player-view.test.js.map