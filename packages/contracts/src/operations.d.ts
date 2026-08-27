import { z } from "zod";
export declare const OperationCauseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"UNCONTESTED">;
    intentActorId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"RESOLUTION">;
    resolutionId: z.ZodString;
    allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
        CRITICAL_FAILURE: "CRITICAL_FAILURE";
        FAILURE: "FAILURE";
        SUCCESS: "SUCCESS";
        CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
    }>>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"SYSTEM">;
    systemRule: z.ZodEnum<{
        INITIATIVE: "INITIATIVE";
        TIME: "TIME";
        CHECKPOINT: "CHECKPOINT";
        REWIND: "REWIND";
    }>;
}, z.core.$strict>], "type">;
export declare const WorldOperationSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    value: z.ZodNumber;
    actorId: z.ZodString;
    kind: z.ZodLiteral<"SET_HP">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    value: z.ZodNumber;
    actorId: z.ZodString;
    kind: z.ZodLiteral<"SET_TEMP_HP">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    resourceId: z.ZodString;
    amount: z.ZodNumber;
    actorId: z.ZodString;
    kind: z.ZodLiteral<"SPEND_RESOURCE">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    resourceId: z.ZodString;
    amount: z.ZodNumber;
    actorId: z.ZodString;
    kind: z.ZodLiteral<"RESTORE_RESOURCE">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    condition: z.ZodString;
    actorId: z.ZodString;
    kind: z.ZodLiteral<"ADD_CONDITION">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    condition: z.ZodString;
    actorId: z.ZodString;
    kind: z.ZodLiteral<"REMOVE_CONDITION">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    locationId: z.ZodString;
    actorId: z.ZodString;
    kind: z.ZodLiteral<"MOVE_ACTOR">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"ADD_INVENTORY">;
    item: z.ZodObject<{
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
            kind: z.ZodString;
            text: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"REMOVE_INVENTORY">;
    itemId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"SET_EQUIPPED">;
    itemId: z.ZodString;
    slots: z.ZodArray<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"SET_COMBAT">;
    combat: z.ZodNullable<z.ZodUnknown>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"ADVANCE_INITIATIVE">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"ADD_FACT">;
    fact: z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        kind: z.ZodString;
        text: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"ADD_EVENT">;
    event: z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        kind: z.ZodString;
        text: z.ZodString;
    }, z.core.$strict>;
    intentActorId: z.ZodOptional<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"ADVANCE_CLOCK">;
    clockId: z.ZodString;
    amount: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"SET_NPC_ATTITUDE">;
    npcId: z.ZodString;
    status: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"SET_QUEST_STATUS">;
    questId: z.ZodString;
    status: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"SET_FLAG">;
    flag: z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodEnum<{
            BILL: "BILL";
            RAVEN: "RAVEN";
            DIRECTOR: "DIRECTOR";
            PUBLIC: "PUBLIC";
            PARTY: "PARTY";
        }>;
        key: z.ZodString;
        text: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    reason: z.ZodString;
    audience: z.ZodEnum<{
        BILL: "BILL";
        RAVEN: "RAVEN";
        DIRECTOR: "DIRECTOR";
        PUBLIC: "PUBLIC";
        PARTY: "PARTY";
    }>;
    cause: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"UNCONTESTED">;
        intentActorId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"RESOLUTION">;
        resolutionId: z.ZodString;
        allowedOutcomeTiers: z.ZodArray<z.ZodEnum<{
            CRITICAL_FAILURE: "CRITICAL_FAILURE";
            FAILURE: "FAILURE";
            SUCCESS: "SUCCESS";
            CRITICAL_SUCCESS: "CRITICAL_SUCCESS";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"SYSTEM">;
        systemRule: z.ZodEnum<{
            INITIATIVE: "INITIATIVE";
            TIME: "TIME";
            CHECKPOINT: "CHECKPOINT";
            REWIND: "REWIND";
        }>;
    }, z.core.$strict>], "type">;
    kind: z.ZodLiteral<"SET_DECISION">;
    decision: z.ZodUnknown;
}, z.core.$strict>], "kind">;
export type OperationCause = z.infer<typeof OperationCauseSchema>;
export type WorldOperation = z.infer<typeof WorldOperationSchema>;
//# sourceMappingURL=operations.d.ts.map