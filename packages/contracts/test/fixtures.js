import { WorldStateSchema, } from "@third-chair/contracts";
export const campaignId = "test_campaign";
export const decisionId = "test_decision";
export const clientRequestId = "test_request";
export const billIntent = {
    seat: "BILL",
    actorId: "test_actor_bill",
    mode: "ACT",
    declaredAction: "Open the door",
    desiredOutcome: "Enter safely",
    approach: "Carefully",
    committedResourceIds: [],
    targetIds: [],
    contingency: "Retreat if trapped",
};
export const ravenIntent = {
    ...billIntent,
    seat: "RAVEN",
    actorId: "test_actor_raven",
};
export const bothDecision = {
    id: decisionId,
    stateVersion: 0,
    mode: "EXPLORATION",
    owner: "BOTH",
    eligibleActorIds: ["test_actor_bill", "test_actor_raven"],
    situation: "A closed door blocks the way.",
    constraints: "Stay together.",
    requiredInput: "Each player declares an action.",
    legalOptions: [],
};
export const ravenDecision = {
    ...bothDecision,
    id: "test_decision_raven",
    owner: "RAVEN",
};
const actor = (controller, name) => ({
    controller,
    name,
    level: 1,
    classSourceKey: "fighter",
    ancestrySourceKey: "human",
    backgroundSourceKey: "soldier",
    abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    proficiencyBonus: 2,
    armorClass: 10,
    maxHp: 10,
    currentHp: 10,
    temporaryHp: 0,
    speed: 30,
    conditions: [],
    deathSaves: { successes: 0, failures: 0 },
    resources: {},
    spells: [],
    equipmentIds: [],
    publicNotes: [],
    scopedNotes: [],
});
export const minimumWorldStateInput = {
    metadata: {
        schemaVersion: 1,
        campaignId,
        turnNumber: 0,
        stateVersion: 0,
        worldDate: { yearDr: 1375, month: "Mirtul", day: 1 },
        currentLocationId: "test_location",
        sceneId: "test_scene",
        rngCounter: 0,
    },
    table: { rulesEdition: "SRD_5_1", settingDateDr: 1375, diceMode: "SERVER_OPEN", deathMode: "STANDARD", houseRules: [] },
    actors: {
        test_actor_bill: actor("BILL", "Bill"),
        test_actor_raven: actor("RAVEN", "Raven"),
    },
    inventory: {},
    combat: null,
    locations: {
        test_location: { id: "test_location", audience: "PUBLIC", name: "Road", status: "Known", facts: [] },
    },
    npcs: {},
    factions: {},
    quests: {},
    facts: [],
    events: [],
    clocks: {},
    flags: [],
    currentDecision: bothDecision,
};
export const minimumWorldState = WorldStateSchema.parse(minimumWorldStateInput);
//# sourceMappingURL=fixtures.js.map