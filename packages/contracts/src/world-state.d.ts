import { z } from "zod";
import { type DecisionRequest } from "./decisions.js";
import { type PlayerSeat } from "./ids.js";
import { type ActorIntent } from "./intents.js";
export declare const ScopedFactSchema: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    text: z.ZodString;
    kind: z.ZodString;
}, z.core.$strict>;
export declare const ScopedEventSchema: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    text: z.ZodString;
    kind: z.ZodString;
}, z.core.$strict>;
export declare const ScopedFlagSchema: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    text: z.ZodString;
    key: z.ZodString;
}, z.core.$strict>;
export declare const ResourceStateSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    current: z.ZodNumber;
    maximum: z.ZodNumber;
}, z.core.$strict>;
export declare const ActorStateSchema: z.ZodObject<{
    controller: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
    }>;
    name: z.ZodString;
    level: z.ZodNumber;
    classSourceKey: z.ZodString;
    ancestrySourceKey: z.ZodString;
    backgroundSourceKey: z.ZodString;
    abilities: z.ZodObject<{
        strength: z.ZodNumber;
        dexterity: z.ZodNumber;
        constitution: z.ZodNumber;
        intelligence: z.ZodNumber;
        wisdom: z.ZodNumber;
        charisma: z.ZodNumber;
    }, z.core.$strict>;
    proficiencyBonus: z.ZodNumber;
    armorClass: z.ZodNumber;
    maxHp: z.ZodNumber;
    currentHp: z.ZodNumber;
    temporaryHp: z.ZodNumber;
    speed: z.ZodNumber;
    conditions: z.ZodArray<z.ZodString>;
    deathSaves: z.ZodObject<{
        successes: z.ZodNumber;
        failures: z.ZodNumber;
    }, z.core.$strict>;
    resources: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        current: z.ZodNumber;
        maximum: z.ZodNumber;
    }, z.core.$strict>>;
    spells: z.ZodArray<z.ZodString>;
    equipmentIds: z.ZodArray<z.ZodString>;
    publicNotes: z.ZodArray<z.ZodString>;
    scopedNotes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const InventoryItemSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    ownerActorId: z.ZodNullable<z.ZodString>;
    containerId: z.ZodNullable<z.ZodString>;
    quantity: z.ZodNumber;
    equippedSlots: z.ZodArray<z.ZodString>;
    facts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const CombatStateSchema: z.ZodObject<{
    id: z.ZodString;
    round: z.ZodNumber;
    currentActorId: z.ZodString;
    initiativeOrder: z.ZodArray<z.ZodString>;
    facts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const LocationStateSchema: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    name: z.ZodString;
    status: z.ZodString;
    facts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const NpcStateSchema: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    name: z.ZodString;
    status: z.ZodString;
    facts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const FactionStateSchema: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    name: z.ZodString;
    status: z.ZodString;
    facts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const QuestStateSchema: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    name: z.ZodString;
    status: z.ZodString;
    facts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const ClockStateSchema: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    name: z.ZodString;
    status: z.ZodString;
    current: z.ZodNumber;
    maximum: z.ZodNumber;
    facts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const WorldStateSchema: z.ZodObject<{
    metadata: z.ZodObject<{
        schemaVersion: z.ZodLiteral<1>;
        campaignId: z.ZodString;
        turnNumber: z.ZodNumber;
        stateVersion: z.ZodNumber;
        worldDate: z.ZodObject<{
            yearDr: z.ZodNumber;
            month: z.ZodString;
            day: z.ZodNumber;
        }, z.core.$strict>;
        currentLocationId: z.ZodString;
        sceneId: z.ZodString;
        rngCounter: z.ZodNumber;
    }, z.core.$strict>;
    table: z.ZodObject<{
        rulesEdition: z.ZodLiteral<"SRD_5_1">;
        settingDateDr: z.ZodLiteral<1375>;
        diceMode: z.ZodLiteral<"SERVER_OPEN">;
        deathMode: z.ZodEnum<{
            STANDARD: "STANDARD";
            HEROIC: "HEROIC";
        }>;
        houseRules: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            text: z.ZodString;
            acceptedAtTurn: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    actors: z.ZodRecord<z.ZodString, z.ZodObject<{
        controller: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
        }>;
        name: z.ZodString;
        level: z.ZodNumber;
        classSourceKey: z.ZodString;
        ancestrySourceKey: z.ZodString;
        backgroundSourceKey: z.ZodString;
        abilities: z.ZodObject<{
            strength: z.ZodNumber;
            dexterity: z.ZodNumber;
            constitution: z.ZodNumber;
            intelligence: z.ZodNumber;
            wisdom: z.ZodNumber;
            charisma: z.ZodNumber;
        }, z.core.$strict>;
        proficiencyBonus: z.ZodNumber;
        armorClass: z.ZodNumber;
        maxHp: z.ZodNumber;
        currentHp: z.ZodNumber;
        temporaryHp: z.ZodNumber;
        speed: z.ZodNumber;
        conditions: z.ZodArray<z.ZodString>;
        deathSaves: z.ZodObject<{
            successes: z.ZodNumber;
            failures: z.ZodNumber;
        }, z.core.$strict>;
        resources: z.ZodRecord<z.ZodString, z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            current: z.ZodNumber;
            maximum: z.ZodNumber;
        }, z.core.$strict>>;
        spells: z.ZodArray<z.ZodString>;
        equipmentIds: z.ZodArray<z.ZodString>;
        publicNotes: z.ZodArray<z.ZodString>;
        scopedNotes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            audience: z.ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                PUBLIC: "PUBLIC";
                PARTY: "PARTY";
            }>;
            text: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    inventory: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        ownerActorId: z.ZodNullable<z.ZodString>;
        containerId: z.ZodNullable<z.ZodString>;
        quantity: z.ZodNumber;
        equippedSlots: z.ZodArray<z.ZodString>;
        facts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            audience: z.ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                PUBLIC: "PUBLIC";
                PARTY: "PARTY";
            }>;
            text: z.ZodString;
            kind: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    combat: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        round: z.ZodNumber;
        currentActorId: z.ZodString;
        initiativeOrder: z.ZodArray<z.ZodString>;
        facts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            audience: z.ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                PUBLIC: "PUBLIC";
                PARTY: "PARTY";
            }>;
            text: z.ZodString;
            kind: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    locations: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        name: z.ZodString;
        status: z.ZodString;
        facts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            audience: z.ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                PUBLIC: "PUBLIC";
                PARTY: "PARTY";
            }>;
            text: z.ZodString;
            kind: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    npcs: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        name: z.ZodString;
        status: z.ZodString;
        facts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            audience: z.ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                PUBLIC: "PUBLIC";
                PARTY: "PARTY";
            }>;
            text: z.ZodString;
            kind: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    factions: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        name: z.ZodString;
        status: z.ZodString;
        facts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            audience: z.ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                PUBLIC: "PUBLIC";
                PARTY: "PARTY";
            }>;
            text: z.ZodString;
            kind: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    quests: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        name: z.ZodString;
        status: z.ZodString;
        facts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            audience: z.ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                PUBLIC: "PUBLIC";
                PARTY: "PARTY";
            }>;
            text: z.ZodString;
            kind: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    facts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        kind: z.ZodString;
    }, z.core.$strict>>;
    clocks: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        name: z.ZodString;
        status: z.ZodString;
        current: z.ZodNumber;
        maximum: z.ZodNumber;
        facts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            audience: z.ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                PUBLIC: "PUBLIC";
                PARTY: "PARTY";
            }>;
            text: z.ZodString;
            kind: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    flags: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        text: z.ZodString;
        key: z.ZodString;
    }, z.core.$strict>>;
    currentDecision: z.ZodObject<{
        id: z.ZodString;
        stateVersion: z.ZodNumber;
        mode: z.ZodEnum<{
            EXPLORATION: "EXPLORATION";
            ENCOUNTER: "ENCOUNTER";
            COMBAT: "COMBAT";
            DOWNTIME: "DOWNTIME";
            REACTION: "REACTION";
            ADVANCEMENT: "ADVANCEMENT";
            CLARIFICATION: "CLARIFICATION";
        }>;
        owner: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            BOTH: "BOTH";
        }>;
        eligibleActorIds: z.ZodArray<z.ZodString>;
        situation: z.ZodString;
        constraints: z.ZodString;
        requiredInput: z.ZodString;
        legalOptions: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type WorldState = z.infer<typeof WorldStateSchema>;
export declare function requiredSeats(decision: DecisionRequest): Set<PlayerSeat>;
export declare function validateIntentsForDecision(decision: DecisionRequest, intents: ActorIntent[], currentState: WorldState): void;
//# sourceMappingURL=world-state.d.ts.map