import type { TurnEngine } from "@third-chair/engine";
import { type ToolResult } from "../result.js";
export declare const advanceGameDescriptor: {
    readonly name: "advance_game";
    readonly description: "Use this when both required player intents are ready to resolve.";
    readonly inputSchema: {
        kind: import("zod").ZodLiteral<"INTENTS">;
        campaignId: import("zod").ZodString;
        expectedStateVersion: import("zod").ZodNumber;
        decisionId: import("zod").ZodString;
        clientRequestId: import("zod").ZodString;
        intents: import("zod").ZodArray<import("zod").ZodObject<{
            seat: import("zod").ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
            }>;
            actorId: import("zod").ZodString;
            mode: import("zod").ZodEnum<{
                ACT: "ACT";
                DEFER: "DEFER";
                DECLINE_REACTION: "DECLINE_REACTION";
            }>;
            declaredAction: import("zod").ZodOptional<import("zod").ZodString>;
            desiredOutcome: import("zod").ZodOptional<import("zod").ZodString>;
            approach: import("zod").ZodOptional<import("zod").ZodString>;
            committedResourceIds: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodString>>;
            targetIds: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodString>>;
            contingency: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strict>>;
    };
    readonly outputSchema: {
        campaignId: import("zod").ZodString;
        stateVersion: import("zod").ZodNumber;
        worldDate: import("zod").ZodObject<{
            yearDr: import("zod").ZodNumber;
            month: import("zod").ZodString;
            day: import("zod").ZodNumber;
        }, import("zod/v4/core").$strict>;
        location: import("zod").ZodObject<{
            id: import("zod").ZodString;
            name: import("zod").ZodString;
            status: import("zod").ZodString;
            facts: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                kind: import("zod").ZodString;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strict>>;
        }, import("zod/v4/core").$strict>;
        sceneId: import("zod").ZodString;
        actors: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            controller: import("zod").ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
            }>;
            name: import("zod").ZodString;
            level: import("zod").ZodNumber;
            abilities: import("zod").ZodObject<{
                strength: import("zod").ZodNumber;
                dexterity: import("zod").ZodNumber;
                constitution: import("zod").ZodNumber;
                intelligence: import("zod").ZodNumber;
                wisdom: import("zod").ZodNumber;
                charisma: import("zod").ZodNumber;
            }, import("zod/v4/core").$strict>;
            proficiencyBonus: import("zod").ZodNumber;
            armorClass: import("zod").ZodNumber;
            maxHp: import("zod").ZodNumber;
            currentHp: import("zod").ZodNumber;
            temporaryHp: import("zod").ZodNumber;
            speed: import("zod").ZodNumber;
            conditions: import("zod").ZodArray<import("zod").ZodString>;
            deathSaves: import("zod").ZodObject<{
                successes: import("zod").ZodNumber;
                failures: import("zod").ZodNumber;
            }, import("zod/v4/core").$strict>;
            publicNotes: import("zod").ZodArray<import("zod").ZodString>;
            resources: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                name: import("zod").ZodString;
                current: import("zod").ZodNumber;
                maximum: import("zod").ZodNumber;
            }, import("zod/v4/core").$strict>>>;
            scopedNotes: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strict>>>;
        }, import("zod/v4/core").$strict>>;
        inventory: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            name: import("zod").ZodString;
            ownerActorId: import("zod").ZodNullable<import("zod").ZodString>;
            containerId: import("zod").ZodNullable<import("zod").ZodString>;
            quantity: import("zod").ZodNumber;
            equippedSlots: import("zod").ZodArray<import("zod").ZodString>;
            facts: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                kind: import("zod").ZodString;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strict>>;
        }, import("zod/v4/core").$strict>>;
        npcs: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            name: import("zod").ZodString;
            status: import("zod").ZodString;
            facts: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                kind: import("zod").ZodString;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strict>>;
        }, import("zod/v4/core").$strict>>;
        factions: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            name: import("zod").ZodString;
            status: import("zod").ZodString;
            facts: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                kind: import("zod").ZodString;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strict>>;
        }, import("zod/v4/core").$strict>>;
        facts: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            kind: import("zod").ZodString;
            text: import("zod").ZodString;
        }, import("zod/v4/core").$strict>>;
        events: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            kind: import("zod").ZodString;
            text: import("zod").ZodString;
        }, import("zod/v4/core").$strict>>;
        clocks: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            name: import("zod").ZodString;
            status: import("zod").ZodString;
            current: import("zod").ZodNumber;
            maximum: import("zod").ZodNumber;
            facts: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                kind: import("zod").ZodString;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strict>>;
        }, import("zod/v4/core").$strict>>;
        openThreads: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            name: import("zod").ZodString;
            status: import("zod").ZodString;
            facts: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                kind: import("zod").ZodString;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strict>>;
        }, import("zod/v4/core").$strict>>;
        combat: import("zod").ZodNullable<import("zod").ZodObject<{
            id: import("zod").ZodString;
            round: import("zod").ZodNumber;
            currentActorId: import("zod").ZodNullable<import("zod").ZodString>;
            initiativeOrder: import("zod").ZodArray<import("zod").ZodString>;
            facts: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                kind: import("zod").ZodString;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strict>>;
        }, import("zod/v4/core").$strict>>;
        currentDecision: import("zod").ZodObject<{
            id: import("zod").ZodString;
            stateVersion: import("zod").ZodNumber;
            mode: import("zod").ZodEnum<{
                EXPLORATION: "EXPLORATION";
                ENCOUNTER: "ENCOUNTER";
                COMBAT: "COMBAT";
                DOWNTIME: "DOWNTIME";
                REACTION: "REACTION";
                ADVANCEMENT: "ADVANCEMENT";
                CLARIFICATION: "CLARIFICATION";
            }>;
            owner: import("zod").ZodEnum<{
                BILL: "BILL";
                RAVEN: "RAVEN";
                DIRECTOR: "DIRECTOR";
                BOTH: "BOTH";
            }>;
            situation: import("zod").ZodString;
            eligibleActorIds: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
            constraints: import("zod").ZodOptional<import("zod").ZodString>;
            requiredInput: import("zod").ZodOptional<import("zod").ZodString>;
            legalOptions: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
        }, import("zod/v4/core").$strict>;
        recoveryStatus: import("zod").ZodLiteral<"NONE">;
    };
    readonly annotations: {
        readonly readOnlyHint: false;
        readonly destructiveHint: false;
        readonly openWorldHint: false;
        readonly idempotentHint: true;
    };
};
export declare function advanceGame(deps: {
    engine: TurnEngine;
}, input: unknown): Promise<ToolResult>;
//# sourceMappingURL=advance-game.d.ts.map