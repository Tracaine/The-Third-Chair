import { type ActorIntent, type DecisionRequest } from "@third-chair/contracts";
export declare const campaignId = "test_campaign";
export declare const decisionId = "test_decision";
export declare const clientRequestId = "test_request";
export declare const billIntent: ActorIntent;
export declare const ravenIntent: ActorIntent;
export declare const bothDecision: DecisionRequest;
export declare const ravenDecision: DecisionRequest;
export declare const minimumWorldStateInput: {
    metadata: {
        schemaVersion: number;
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
        rulesEdition: string;
        settingDateDr: number;
        diceMode: string;
        deathMode: string;
        houseRules: never[];
    };
    actors: {
        test_actor_bill: {
            controller: "BILL" | "RAVEN";
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
            conditions: never[];
            deathSaves: {
                successes: number;
                failures: number;
            };
            resources: {};
            spells: never[];
            equipmentIds: never[];
            publicNotes: never[];
            scopedNotes: never[];
        };
        test_actor_raven: {
            controller: "BILL" | "RAVEN";
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
            conditions: never[];
            deathSaves: {
                successes: number;
                failures: number;
            };
            resources: {};
            spells: never[];
            equipmentIds: never[];
            publicNotes: never[];
            scopedNotes: never[];
        };
    };
    inventory: {};
    combat: null;
    locations: {
        test_location: {
            id: string;
            audience: string;
            name: string;
            status: string;
            facts: never[];
        };
    };
    npcs: {};
    factions: {};
    quests: {};
    facts: never[];
    events: never[];
    clocks: {};
    flags: never[];
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
export declare const minimumWorldState: {
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
//# sourceMappingURL=fixtures.d.ts.map