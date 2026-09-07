import { describe, expect, it } from "vitest";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";
import { createTurnEngine, FailureInjector, FakeDirector, FakeNarrator, sha256Json } from "@third-chair/engine";
import { createCampaignRepository, createJournalRepository, createTurnRepository } from "@third-chair/storage";
import { createTempDatabase } from "@third-chair/storage/test/fixtures";

describe("journal commit atomicity", () => {
  it("does not commit the turn or any journal when journal preparation fails", async () => {
    const temp = createTempDatabase();
    try {
      const state = structuredClone(minimumWorldState);
      const campaigns = createCampaignRepository(temp.db);
      const turns = createTurnRepository(temp.db);
      campaigns.createCampaign({
        id: state.metadata.campaignId, ownerId: "owner", name: "Atomic journal", sourcePackHash: "hash",
        rngSeed: new Uint8Array(32), currentState: state, currentStateHash: sha256Json(state),
        rootBranchId: "test_branch_journal_atomicity", rootBranchLabel: "Main",
      });
      const director = new FakeDirector((input) => ({
        uncontestedOperations: [], checkLinkedOperations: [], memoryWrites: [], riskTags: [],
        nextDecision: { ...input.state.currentDecision, id: "test_decision_after_journal", stateVersion: 999 },
        narrativeBrief: { summary: "The party waits.", requiredResolutionIds: [], requiredEventIds: [] },
      }));
      const narrator = new FakeNarrator(() => ({
        sceneText: "The party waits beneath the old trees.", spokenNpcLines: [],
        mustIncludeResolutionIds: [], mustIncludeEventIds: [], visibleEventIds: [],
      }));
      const engine = createTurnEngine({
        campaigns, turns, director, narrator, newTurnId: () => "test_turn_journal_atomicity",
        failureInjector: new FailureInjector("JOURNAL"),
      });

      await expect(engine.advanceGame({
        kind: "INTENTS", campaignId: state.metadata.campaignId, expectedStateVersion: 0,
        decisionId: state.currentDecision.id, clientRequestId: "test_request_journal_atomicity",
        intents: [
          { seat: "BILL", actorId: "test_actor_bill", mode: "ACT", declaredAction: "Wait", desiredOutcome: "Listen", approach: "Quietly", committedResourceIds: [], targetIds: [], contingency: "Stay still" },
          { seat: "RAVEN", actorId: "test_actor_raven", mode: "ACT", declaredAction: "Watch", desiredOutcome: "Spot danger", approach: "Carefully", committedResourceIds: [], targetIds: [], contingency: "Warn Bill" },
        ],
      })).rejects.toThrow("INJECTED_FAILURE:JOURNAL");

      expect(campaigns.getCampaign(state.metadata.campaignId).stateVersion).toBe(0);
      expect(turns.getTurn("test_turn_journal_atomicity").status).toBe("RESOLVED");
      expect(createJournalRepository(temp.db).listAtVersion(state.metadata.campaignId, 1)).toEqual([]);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("commits Bill, Raven, and Party journals with the same state version as the turn", async () => {
    const temp = createTempDatabase();
    try {
      const state = structuredClone(minimumWorldState);
      const campaigns = createCampaignRepository(temp.db);
      const turns = createTurnRepository(temp.db);
      campaigns.createCampaign({
        id: state.metadata.campaignId, ownerId: "owner", name: "Journal success", sourcePackHash: "hash",
        rngSeed: new Uint8Array(32), currentState: state, currentStateHash: sha256Json(state),
        rootBranchId: "test_branch_journal_success", rootBranchLabel: "Main",
      });
      const engine = createTurnEngine({
        campaigns,
        turns,
        director: new FakeDirector((input) => ({
          uncontestedOperations: [], checkLinkedOperations: [], memoryWrites: [], riskTags: [],
          nextDecision: { ...input.state.currentDecision, id: "test_decision_after_journal_success", stateVersion: 999 },
          narrativeBrief: { summary: "The party listens.", requiredResolutionIds: [], requiredEventIds: [] },
        })),
        narrator: new FakeNarrator(() => ({
          sceneText: "Leaves stir while Bill and Raven listen.", spokenNpcLines: [],
          mustIncludeResolutionIds: [], mustIncludeEventIds: [], visibleEventIds: [],
        })),
        newTurnId: () => "test_turn_journal_success",
      });

      const result = await engine.advanceGame({
        kind: "INTENTS", campaignId: state.metadata.campaignId, expectedStateVersion: 0,
        decisionId: state.currentDecision.id, clientRequestId: "test_request_journal_success",
        intents: [
          { seat: "BILL", actorId: "test_actor_bill", mode: "ACT", declaredAction: "Listen", desiredOutcome: "Hear danger", approach: "Quietly", committedResourceIds: [], targetIds: [], contingency: "Wait" },
          { seat: "RAVEN", actorId: "test_actor_raven", mode: "ACT", declaredAction: "Watch", desiredOutcome: "See danger", approach: "Carefully", committedResourceIds: [], targetIds: [], contingency: "Warn Bill" },
        ],
      });

      expect(result.kind).toBe("COMMITTED");
      const journals = createJournalRepository(temp.db).listAtVersion(state.metadata.campaignId, 1);
      expect(journals.map(({ audience }) => audience)).toEqual(["BILL", "PARTY", "RAVEN"]);
      expect(journals.every(({ stateVersion, journalHash }) => stateVersion === 1 && journalHash.length === 64)).toBe(true);
      expect(journals.every(({ journal }) => journal.recentTurns[0]?.turnId === "test_turn_journal_success")).toBe(true);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});
