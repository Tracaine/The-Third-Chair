import { describe, expect, it } from "vitest";
import { ActorIntentSchema, AdvanceGameCommandSchema, DecisionRequestSchema, IntentAdvanceGameCommandSchema, WorldStateSchema, } from "@third-chair/contracts";
import { billIntent, bothDecision, campaignId, clientRequestId, decisionId, minimumWorldStateInput, ravenIntent, } from "./fixtures.js";
describe("world state", () => {
    it("round-trips the minimum valid world state", () => {
        expect(WorldStateSchema.parse(minimumWorldStateInput)).toEqual(minimumWorldStateInput);
    });
    it("requires the ordinary advance command discriminant", () => {
        expect(IntentAdvanceGameCommandSchema.parse({
            kind: "INTENTS",
            campaignId,
            expectedStateVersion: 0,
            decisionId,
            clientRequestId,
            intents: [billIntent, ravenIntent],
        }).kind).toBe("INTENTS");
    });
    it("exports the public command schema as the ordinary command alias", () => {
        expect(AdvanceGameCommandSchema).toBe(IntentAdvanceGameCommandSchema);
    });
    it("defaults omitted intent ID arrays", () => {
        expect(ActorIntentSchema.parse({ ...billIntent, committedResourceIds: undefined, targetIds: undefined }))
            .toMatchObject({ committedResourceIds: [], targetIds: [] });
    });
    it("accepts free text at 2,000 characters and rejects longer values", () => {
        expect(ActorIntentSchema.parse({ ...billIntent, declaredAction: "a".repeat(2_000) }).declaredAction)
            .toHaveLength(2_000);
        expect(() => ActorIntentSchema.parse({ ...billIntent, declaredAction: "a".repeat(2_001) })).toThrow();
    });
    it("allows at most twelve legal options", () => {
        expect(DecisionRequestSchema.parse({ ...bothDecision, legalOptions: Array(12).fill("wait") }).legalOptions)
            .toHaveLength(12);
        expect(() => DecisionRequestSchema.parse({ ...bothDecision, legalOptions: Array(13).fill("wait") })).toThrow();
    });
    it("rejects unknown nested world-state keys", () => {
        expect(() => WorldStateSchema.parse({
            ...minimumWorldStateInput,
            actors: {
                ...minimumWorldStateInput.actors,
                test_actor_bill: {
                    ...minimumWorldStateInput.actors.test_actor_bill,
                    abilities: { ...minimumWorldStateInput.actors.test_actor_bill.abilities, unseen: true },
                },
            },
        })).toThrow();
    });
    it("rejects unknown mutating-command keys", () => {
        expect(() => IntentAdvanceGameCommandSchema.parse({
            kind: "INTENTS",
            campaignId,
            expectedStateVersion: 0,
            decisionId,
            clientRequestId,
            intents: [billIntent, ravenIntent],
            unexpected: true,
        })).toThrow();
    });
});
//# sourceMappingURL=world-state.test.js.map