import { type ActorIntent, type CheckResolution, type DecisionRequest, type ResolutionPlan, type TurnProposal, type WorldState } from "@third-chair/contracts";
import { openCampaignDatabase, type BeginTurnInput } from "@third-chair/storage";
export declare const billIntent: ActorIntent;
export declare function decision(suffix: string, stateVersion?: number): DecisionRequest;
export declare function worldState(suffix: string, stateVersion?: number): WorldState;
export declare function createTempDatabase(): {
    db: import("node:sqlite").DatabaseSync;
    directory: string;
    path: string;
    close(): void;
    cleanup(): void;
};
export declare function seedCampaign(db: ReturnType<typeof openCampaignDatabase>, suffix: string): {
    campaignId: string;
    rootBranchId: string;
    state: {
        metadata: {
            schemaVersion: 1;
            campaignId: string;
            turnNumber: number;
            stateVersion: number;
            worldDate: {
                yearDr: number;
                month: string;
                day: number;
            };
            currentLocationId: string;
            sceneId: string;
            rngCounter: number;
        };
        table: {
            rulesEdition: "SRD_5_1";
            settingDateDr: 1375;
            diceMode: "SERVER_OPEN";
            deathMode: "STANDARD" | "HEROIC";
            houseRules: {
                id: string;
                title: string;
                text: string;
                acceptedAtTurn: number;
            }[];
        };
        actors: Record<string, {
            controller: "BILL" | "RAVEN" | "DIRECTOR";
            name: string;
            level: number;
            classSourceKey: string;
            ancestrySourceKey: string;
            backgroundSourceKey: string;
            abilities: {
                strength: number;
                dexterity: number;
                constitution: number;
                intelligence: number;
                wisdom: number;
                charisma: number;
            };
            proficiencyBonus: number;
            armorClass: number;
            maxHp: number;
            currentHp: number;
            temporaryHp: number;
            speed: number;
            conditions: string[];
            deathSaves: {
                successes: number;
                failures: number;
            };
            resources: Record<string, {
                id: string;
                name: string;
                current: number;
                maximum: number;
            }>;
            spells: string[];
            equipmentIds: string[];
            publicNotes: string[];
            scopedNotes: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
            }[];
        }>;
        inventory: Record<string, {
            id: string;
            name: string;
            ownerActorId: string | null;
            containerId: string | null;
            quantity: number;
            equippedSlots: string[];
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        combat: {
            id: string;
            round: number;
            currentActorId: string;
            initiativeOrder: string[];
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        } | null;
        locations: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        npcs: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        factions: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        quests: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        facts: {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            text: string;
            kind: string;
        }[];
        events: {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            text: string;
            kind: string;
        }[];
        clocks: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            current: number;
            maximum: number;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        flags: {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            text: string;
            key: string;
        }[];
        currentDecision: {
            id: string;
            stateVersion: number;
            mode: "EXPLORATION" | "ENCOUNTER" | "COMBAT" | "DOWNTIME" | "REACTION" | "ADVANCEMENT" | "CLARIFICATION";
            owner: "BILL" | "RAVEN" | "DIRECTOR" | "BOTH";
            eligibleActorIds: string[];
            situation: string;
            constraints: string;
            requiredInput: string;
            legalOptions: string[];
        };
    };
};
export declare function beginInput(suffix: string): BeginTurnInput;
export declare function resolutionPlan(suffix: string): ResolutionPlan;
export declare function checkResolution(suffix: string, planId: string, endingCounter?: number, naturalDie?: number): CheckResolution;
export declare function turnProposal(nextDecision: DecisionRequest): TurnProposal;
export declare function committedCandidate(before: WorldState, suffix: string, rngCounter: number): {
    candidate: {
        metadata: {
            schemaVersion: 1;
            campaignId: string;
            turnNumber: number;
            stateVersion: number;
            worldDate: {
                yearDr: number;
                month: string;
                day: number;
            };
            currentLocationId: string;
            sceneId: string;
            rngCounter: number;
        };
        table: {
            rulesEdition: "SRD_5_1";
            settingDateDr: 1375;
            diceMode: "SERVER_OPEN";
            deathMode: "STANDARD" | "HEROIC";
            houseRules: {
                id: string;
                title: string;
                text: string;
                acceptedAtTurn: number;
            }[];
        };
        actors: Record<string, {
            controller: "BILL" | "RAVEN" | "DIRECTOR";
            name: string;
            level: number;
            classSourceKey: string;
            ancestrySourceKey: string;
            backgroundSourceKey: string;
            abilities: {
                strength: number;
                dexterity: number;
                constitution: number;
                intelligence: number;
                wisdom: number;
                charisma: number;
            };
            proficiencyBonus: number;
            armorClass: number;
            maxHp: number;
            currentHp: number;
            temporaryHp: number;
            speed: number;
            conditions: string[];
            deathSaves: {
                successes: number;
                failures: number;
            };
            resources: Record<string, {
                id: string;
                name: string;
                current: number;
                maximum: number;
            }>;
            spells: string[];
            equipmentIds: string[];
            publicNotes: string[];
            scopedNotes: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
            }[];
        }>;
        inventory: Record<string, {
            id: string;
            name: string;
            ownerActorId: string | null;
            containerId: string | null;
            quantity: number;
            equippedSlots: string[];
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        combat: {
            id: string;
            round: number;
            currentActorId: string;
            initiativeOrder: string[];
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        } | null;
        locations: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        npcs: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        factions: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        quests: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        facts: {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            text: string;
            kind: string;
        }[];
        events: {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            text: string;
            kind: string;
        }[];
        clocks: Record<string, {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            name: string;
            status: string;
            current: number;
            maximum: number;
            facts: {
                id: string;
                audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
                text: string;
                kind: string;
            }[];
        }>;
        flags: {
            id: string;
            audience: "BILL" | "RAVEN" | "DIRECTOR" | "PUBLIC" | "PARTY";
            text: string;
            key: string;
        }[];
        currentDecision: {
            id: string;
            stateVersion: number;
            mode: "EXPLORATION" | "ENCOUNTER" | "COMBAT" | "DOWNTIME" | "REACTION" | "ADVANCEMENT" | "CLARIFICATION";
            owner: "BILL" | "RAVEN" | "DIRECTOR" | "BOTH";
            eligibleActorIds: string[];
            situation: string;
            constraints: string;
            requiredInput: string;
            legalOptions: string[];
        };
    };
    nextDecision: {
        id: string;
        stateVersion: number;
        mode: "EXPLORATION" | "ENCOUNTER" | "COMBAT" | "DOWNTIME" | "REACTION" | "ADVANCEMENT" | "CLARIFICATION";
        owner: "BILL" | "RAVEN" | "DIRECTOR" | "BOTH";
        eligibleActorIds: string[];
        situation: string;
        constraints: string;
        requiredInput: string;
        legalOptions: string[];
    };
};
//# sourceMappingURL=fixtures.d.ts.map