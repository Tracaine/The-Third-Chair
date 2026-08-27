import { describe, expect, it } from "vitest";
import { createCampaignRepository, createTurnRepository } from "@third-chair/storage";
import { createTurnEngine, FakeDirector, FakeNarrator, sha256Json } from "@third-chair/engine";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";
import { createTempDatabase } from "@third-chair/storage/test/fixtures";
describe("resumable exploration turn", () => {
    it("commits a BOTH decision once with code-owned metadata", async () => {
        const temp = createTempDatabase();
        try {
            const state = structuredClone(minimumWorldState);
            const campaignId = state.metadata.campaignId;
            createCampaignRepository(temp.db).createCampaign({ id: campaignId, ownerId: "owner", name: "Test", sourcePackHash: "hash", rngSeed: new Uint8Array(32), currentState: state, currentStateHash: sha256Json(state), rootBranchId: "test_branch_engine", rootBranchLabel: "Main" });
            const director = new FakeDirector((input) => { const resolved = input.runtime.lockAndResolveChecks({ id: "test_plan_engine", checks: [{ id: "test_resolution_engine", actorId: "test_actor_raven", checkKind: "Investigation", key: "investigation", sides: 20, advantage: "NORMAL", advantageReason: "none", modifier: 0, dc: 10, visibility: "PUBLIC", successStakes: "clue", failureStakes: "cost", permittedOutcomeTiers: ["SUCCESS", "FAILURE", "CRITICAL_SUCCESS", "CRITICAL_FAILURE"], citations: [] }] }); return { uncontestedOperations: [], checkLinkedOperations: [{ id: "test_op_engine", kind: "ADD_FACT", reason: "search", audience: "PARTY", cause: { type: "RESOLUTION", resolutionId: resolved.resolutions[0].id, allowedOutcomeTiers: [resolved.resolutions[0].tier] }, fact: { id: "test_fact_engine", audience: "PARTY", kind: "Clue", text: "A marked key." } }], memoryWrites: [], riskTags: [], nextDecision: { ...input.state.currentDecision, id: "test_next_engine", stateVersion: 999, owner: "BILL", eligibleActorIds: ["test_actor_bill"] }, narrativeBrief: { summary: "A clue.", requiredResolutionIds: ["test_resolution_engine"], requiredEventIds: [] } }; });
            const narrator = new FakeNarrator((input) => ({ sceneText: "The desk yields a marked key.", spokenNpcLines: [], mustIncludeResolutionIds: input.proposal.narrativeBrief.requiredResolutionIds, mustIncludeEventIds: [], visibleEventIds: [] }));
            const engine = createTurnEngine({ campaigns: createCampaignRepository(temp.db), turns: createTurnRepository(temp.db), director, narrator, newTurnId: () => "test_turn_engine" });
            const command = { kind: "INTENTS", campaignId, expectedStateVersion: 0, decisionId: state.currentDecision.id, clientRequestId: "test_request_engine", intents: [{ seat: "BILL", actorId: "test_actor_bill", mode: "ACT", declaredAction: "Distract", desiredOutcome: "Time", approach: "Talk", committedResourceIds: [], targetIds: [], contingency: "Run" }, { seat: "RAVEN", actorId: "test_actor_raven", mode: "ACT", declaredAction: "Search", desiredOutcome: "Clue", approach: "Carefully", committedResourceIds: [], targetIds: [], contingency: "Stop" }] };
            const result = await engine.advanceGame(command);
            expect(result.kind).toBe("COMMITTED");
            expect(result.view.stateVersion).toBe(1);
            expect(result.view.currentDecision.stateVersion).toBe(1);
            expect(result.view.currentDecision.owner).toBe("BILL");
            expect(createCampaignRepository(temp.db).getCampaign(campaignId).currentState.metadata.rngCounter).toBe(1);
            const retry = await engine.advanceGame(command);
            expect(retry.turn.id).toBe("test_turn_engine");
            expect(director.calls).toBe(1);
            expect(narrator.calls).toBe(1);
        }
        finally {
            temp.close();
            temp.cleanup();
        }
    });
});
//# sourceMappingURL=exploration-turn.test.js.map