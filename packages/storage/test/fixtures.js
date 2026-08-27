import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DecisionRequestSchema, WorldStateSchema, } from "@third-chair/contracts";
import { createCampaignRepository, openCampaignDatabase, runMigrationsWithBackup, } from "@third-chair/storage";
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
export function decision(suffix, stateVersion = 0) {
    return DecisionRequestSchema.parse({
        id: `test_decision_${suffix}`,
        stateVersion,
        mode: "EXPLORATION",
        owner: "BILL",
        eligibleActorIds: ["test_actor_bill"],
        situation: "A closed door blocks the way.",
        constraints: "Stay alert.",
        requiredInput: "Bill declares an action.",
        legalOptions: [],
    });
}
export function worldState(suffix, stateVersion = 0) {
    const currentDecision = decision(suffix, stateVersion);
    return WorldStateSchema.parse({
        metadata: {
            schemaVersion: 1,
            campaignId: `test_campaign_${suffix}`,
            turnNumber: stateVersion,
            stateVersion,
            worldDate: { yearDr: 1375, month: "Mirtul", day: 1 },
            currentLocationId: "test_location",
            sceneId: "test_scene",
            rngCounter: 0,
        },
        table: {
            rulesEdition: "SRD_5_1",
            settingDateDr: 1375,
            diceMode: "SERVER_OPEN",
            deathMode: "STANDARD",
            houseRules: [],
        },
        actors: {
            test_actor_bill: {
                controller: "BILL",
                name: "Bill",
                level: 1,
                classSourceKey: "fighter",
                ancestrySourceKey: "human",
                backgroundSourceKey: "soldier",
                abilities: {
                    strength: 10,
                    dexterity: 10,
                    constitution: 10,
                    intelligence: 10,
                    wisdom: 10,
                    charisma: 10,
                },
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
            },
        },
        inventory: {},
        combat: null,
        locations: {
            test_location: {
                id: "test_location",
                audience: "PUBLIC",
                name: "Road",
                status: "Known",
                facts: [],
            },
        },
        npcs: {},
        factions: {},
        quests: {},
        facts: [],
        events: [],
        clocks: {},
        flags: [],
        currentDecision,
    });
}
export function createTempDatabase() {
    const directory = mkdtempSync(join(tmpdir(), "third-chair-storage-"));
    const path = join(directory, "campaigns.sqlite");
    runMigrationsWithBackup(path);
    const db = openCampaignDatabase(path);
    return {
        db,
        directory,
        path,
        close() {
            db.close();
        },
        cleanup() {
            rmSync(directory, { recursive: true, force: true });
        },
    };
}
export function seedCampaign(db, suffix) {
    const state = worldState(suffix);
    const campaignId = state.metadata.campaignId;
    const rootBranchId = `test_branch_${suffix}`;
    createCampaignRepository(db).createCampaign({
        id: campaignId,
        ownerId: "test_owner",
        name: `Campaign ${suffix}`,
        sourcePackHash: "source-pack-hash",
        rngSeed: new Uint8Array(32).fill(7),
        currentState: state,
        currentStateHash: `state-hash-${suffix}-0`,
        rootBranchId,
        rootBranchLabel: "Main",
        createdAt: "2026-08-27T12:00:00.000Z",
    });
    return { campaignId, rootBranchId, state };
}
export function beginInput(suffix) {
    return {
        turnId: `test_turn_${suffix}`,
        campaignId: `test_campaign_${suffix}`,
        branchId: `test_branch_${suffix}`,
        clientRequestId: `test_request_${suffix}`,
        expectedStateVersion: 0,
        decisionId: `test_decision_${suffix}`,
        inputHash: `input-hash-${suffix}`,
        lockedIntents: [billIntent],
        modelProfile: { director: "fake" },
        createdAt: "2026-08-27T12:01:00.000Z",
    };
}
export function resolutionPlan(suffix) {
    return {
        id: `test_plan_${suffix}`,
        checks: [{
                id: `test_check_${suffix}`,
                actorId: "test_actor_bill",
                checkKind: "Ability Check",
                key: "strength",
                sides: 20,
                advantage: "NORMAL",
                advantageReason: "No advantage.",
                modifier: 2,
                dc: 10,
                visibility: "PUBLIC",
                successStakes: "The action succeeds.",
                failureStakes: "The action fails.",
                permittedOutcomeTiers: ["CRITICAL_FAILURE", "FAILURE", "SUCCESS", "CRITICAL_SUCCESS"],
                citations: [],
            }],
    };
}
export function checkResolution(suffix, planId, endingCounter = 1, naturalDie = 12) {
    return {
        id: `test_resolution_${suffix}`,
        planId,
        actorId: "test_actor_bill",
        checkKind: "Ability Check",
        key: "strength",
        naturalDice: [naturalDie],
        keptDie: naturalDie,
        modifier: 2,
        total: naturalDie + 2,
        target: 10,
        tier: "SUCCESS",
        visibility: "PUBLIC",
        advantage: "NORMAL",
        advantageReason: "No advantage.",
        successStakes: "The action succeeds.",
        failureStakes: "The action fails.",
        citations: [],
        startingCounter: 0,
        endingCounter,
    };
}
export function turnProposal(nextDecision) {
    return {
        uncontestedOperations: [],
        checkLinkedOperations: [],
        memoryWrites: [],
        riskTags: [],
        nextDecision,
        narrativeBrief: {
            summary: "Test proposal.",
            requiredResolutionIds: [],
            requiredEventIds: [],
        },
    };
}
export function committedCandidate(before, suffix, rngCounter) {
    const nextDecision = decision(`${suffix}_next`, before.metadata.stateVersion + 1);
    const candidate = WorldStateSchema.parse({
        ...structuredClone(before),
        metadata: {
            ...before.metadata,
            stateVersion: before.metadata.stateVersion + 1,
            turnNumber: before.metadata.turnNumber + 1,
            rngCounter,
        },
        currentDecision: nextDecision,
    });
    return { candidate, nextDecision };
}
//# sourceMappingURL=fixtures.js.map