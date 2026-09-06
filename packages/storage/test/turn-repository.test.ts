import { describe, expect, it } from "vitest";
import {
  createCampaignRepository,
  createTurnRepository,
  openCampaignDatabase,
} from "@third-chair/storage";
import {
  beginInput,
  checkResolution,
  committedCandidate,
  createTempDatabase,
  decision,
  resolutionPlan,
  seedCampaign,
  turnProposal,
  worldState,
} from "./fixtures.js";

describe("campaign repository", () => {
  it("creates a campaign and owned root branch atomically", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "atomic");
      const campaign = createCampaignRepository(temp.db).getCampaign(seeded.campaignId);
      expect(campaign.activeBranchId).toBe(seeded.rootBranchId);
      expect(campaign.currentState).toEqual(seeded.state);
      expect(temp.db.prepare("SELECT campaign_id, parent_branch_id, status FROM branches WHERE id = ?").get(seeded.rootBranchId)).toEqual({
        campaign_id: seeded.campaignId,
        parent_branch_id: null,
        status: "ACTIVE",
      });
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("rolls back campaign creation when the active branch cannot be inserted", () => {
    const temp = createTempDatabase();
    try {
      seedCampaign(temp.db, "first");
      expect(() => createCampaignRepository(temp.db).createCampaign({
        id: "test_campaign_rollback",
        ownerId: "test_owner",
        name: "Rollback",
        sourcePackHash: "source",
        rngSeed: new Uint8Array(32),
        currentState: {
          ...worldState("rollback"),
          metadata: {
            ...worldState("rollback").metadata,
            campaignId: "test_campaign_rollback",
          },
        },
        currentStateHash: "hash",
        rootBranchId: "test_branch_first",
        rootBranchLabel: "Main",
      })).toThrow();
      expect(temp.db.prepare("SELECT id FROM campaigns WHERE id = 'test_campaign_rollback'").get()).toBeUndefined();
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});

describe("turn reservation and stages", () => {
  it("is idempotent for the same request and rejects a reused key with different input", () => {
    const temp = createTempDatabase();
    try {
      seedCampaign(temp.db, "idem");
      const repo = createTurnRepository(temp.db);
      const input = beginInput("idem");
      expect(repo.beginTurn(input).kind).toBe("STARTED");
      expect(repo.beginTurn(input)).toMatchObject({ kind: "EXISTING", turn: { id: input.turnId } });
      expect(() => repo.beginTurn({ ...input, inputHash: "different" })).toThrow(
        "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT",
      );
      expect(temp.db.prepare("SELECT count(*) AS count FROM turns").get()).toEqual({ count: 1 });
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("rejects state and decision conflicts without inserting a turn", () => {
    const temp = createTempDatabase();
    try {
      seedCampaign(temp.db, "conflict");
      const repo = createTurnRepository(temp.db);
      expect(() => repo.beginTurn({ ...beginInput("conflict"), expectedStateVersion: 9 })).toThrow("STATE_VERSION_CONFLICT");
      expect(() => repo.beginTurn({ ...beginInput("conflict"), decisionId: "test_wrong_decision" })).toThrow("DECISION_CONFLICT");
      expect(temp.db.prepare("SELECT count(*) AS count FROM turns").get()).toEqual({ count: 0 });
      expect(temp.db.prepare("SELECT count(*) AS count FROM active_turns").get()).toEqual({ count: 0 });
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("returns the authoritative active successor to a competing request on another connection", () => {
    const temp = createTempDatabase();
    const second = openCampaignDatabase(temp.path);
    try {
      seedCampaign(temp.db, "race");
      const winner = createTurnRepository(temp.db).beginTurn(beginInput("race"));
      const competing = {
        ...beginInput("race"),
        turnId: "test_turn_race_loser",
        clientRequestId: "test_request_race_loser",
        inputHash: "input-hash-race-loser",
      };
      const loser = createTurnRepository(second).beginTurn(competing);
      expect(winner).toMatchObject({ kind: "STARTED", turn: { id: "test_turn_race" } });
      expect(loser).toMatchObject({ kind: "ACTIVE_SUCCESSOR", turn: { id: "test_turn_race" } });
      expect(second.prepare("SELECT id FROM turns ORDER BY id").all()).toEqual([{ id: "test_turn_race" }]);
      expect(second.prepare("SELECT count(*) AS count FROM active_turns").get()).toEqual({ count: 1 });
    } finally {
      second.close();
      temp.close();
      temp.cleanup();
    }
  });

  it("enforces legal monotonic stage transitions and keeps forward payloads immutable", () => {
    const temp = createTempDatabase();
    try {
      seedCampaign(temp.db, "stages");
      const repo = createTurnRepository(temp.db);
      const turnId = beginInput("stages").turnId;
      repo.beginTurn(beginInput("stages"));
      const earlyPlan = resolutionPlan("stages_early");
      expect(() => repo.persistResolutions(
        turnId,
        [checkResolution("stages_early", earlyPlan.id)],
        1,
      )).toThrow("ILLEGAL_TURN_TRANSITION");

      const plan = resolutionPlan("stages");
      repo.persistPlan(turnId, plan);
      expect(repo.getTurn(turnId)).toMatchObject({ status: "PLANNED", resolutionPlan: plan });

      const resolutions = [checkResolution("stages", plan.id)];
      repo.persistResolutions(turnId, resolutions, 1);
      const stored = repo.getTurn(turnId);
      expect(stored).toMatchObject({ status: "RESOLVED", resolutions, nextRngCounter: 1 });
      expect(() => repo.persistPlan(turnId, resolutionPlan("stages_rewrite"))).toThrow("ILLEGAL_TURN_TRANSITION");
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("retains the reservation on failure and releases it on atomic abandonment", () => {
    const temp = createTempDatabase();
    try {
      seedCampaign(temp.db, "failure");
      const repo = createTurnRepository(temp.db);
      const turnId = beginInput("failure").turnId;
      repo.beginTurn(beginInput("failure"));
      repo.markFailed(turnId, { code: "DIRECTOR_FAILED", message: "try again" });
      expect(repo.getTurn(turnId).status).toBe("FAILED");
      expect(temp.db.prepare("SELECT turn_id FROM active_turns").get()).toEqual({ turn_id: turnId });

      repo.abandonTurn(turnId, { code: "ABANDONED", message: "stop" });
      expect(temp.db.prepare("SELECT count(*) AS count FROM active_turns").get()).toEqual({ count: 0 });
      expect(createCampaignRepository(temp.db).getCampaign("test_campaign_failure").stateVersion).toBe(0);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});

describe("atomic turn commit", () => {
  it("lists committed campaign turns newest first with a bounded limit", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "recent");
      const repo = createTurnRepository(temp.db);
      const input = beginInput("recent");
      repo.beginTurn(input);
      const plan = resolutionPlan("recent");
      repo.persistPlan(input.turnId, plan);
      repo.persistResolutions(input.turnId, [checkResolution("recent", plan.id)], 1);
      const { candidate, nextDecision } = committedCandidate(seeded.state, "recent", 1);
      repo.persistProposal(input.turnId, turnProposal(nextDecision), candidate);
      repo.commitTurn({
        turnId: input.turnId,
        candidateStateHash: "state-hash-recent-1",
        narration: { sceneText: "The newest public consequence." },
        nextDecision,
      });

      expect(repo.listRecentCommitted(seeded.campaignId, 1)).toMatchObject([
        { id: input.turnId, status: "COMMITTED", committedStateVersion: 1 },
      ]);
      expect(repo.listRecentCommitted("test_campaign_missing", 6)).toEqual([]);
      expect(() => repo.listRecentCommitted(seeded.campaignId, 0)).toThrow("INVALID_TURN_LIMIT");
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("commits the candidate, ledger event, decision, RNG counter, and reservation release together", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "commit");
      const repo = createTurnRepository(temp.db);
      const input = beginInput("commit");
      repo.beginTurn(input);
      const plan = resolutionPlan("commit");
      repo.persistPlan(input.turnId, plan);
      repo.persistResolutions(input.turnId, [checkResolution("commit", plan.id, 3)], 3);
      const { candidate, nextDecision } = committedCandidate(seeded.state, "commit", 3);
      repo.persistProposal(input.turnId, turnProposal(nextDecision), candidate);

      const committed = repo.commitTurn({
        turnId: input.turnId,
        candidateStateHash: "state-hash-commit-1",
        narration: { sceneText: "The door opens." },
        nextDecision,
        committedAt: "2026-08-27T12:02:00.000Z",
      });

      expect(committed).toMatchObject({ id: input.turnId, status: "COMMITTED", committedStateVersion: 1 });
      const campaign = createCampaignRepository(temp.db).getCampaign(seeded.campaignId);
      expect(campaign.currentState).toEqual(candidate);
      expect(campaign.currentDecision).toEqual(nextDecision);
      expect(campaign.currentStateHash).toBe("state-hash-commit-1");
      expect(temp.db.prepare("SELECT status FROM turn_events WHERE turn_id = ?").all(input.turnId)).toEqual([{ status: "COMMITTED" }]);
      expect(temp.db.prepare("SELECT count(*) AS count FROM active_turns").get()).toEqual({ count: 0 });
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("rolls back every write when finalized metadata is inconsistent", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "rollback");
      const repo = createTurnRepository(temp.db);
      const input = beginInput("rollback");
      repo.beginTurn(input);
      const plan = resolutionPlan("rollback");
      repo.persistPlan(input.turnId, plan);
      repo.persistResolutions(input.turnId, [checkResolution("rollback", plan.id, 4)], 4);
      const { candidate, nextDecision } = committedCandidate(seeded.state, "rollback", 3);
      repo.persistProposal(input.turnId, turnProposal(nextDecision), candidate);

      expect(() => repo.commitTurn({
        turnId: input.turnId,
        candidateStateHash: "invalid-hash",
        narration: { sceneText: "Must not commit." },
        nextDecision,
      })).toThrow("RNG_COUNTER_MISMATCH");

      const campaign = createCampaignRepository(temp.db).getCampaign(seeded.campaignId);
      expect(campaign.stateVersion).toBe(0);
      expect(campaign.currentStateHash).toBe("state-hash-rollback-0");
      expect(repo.getTurn(input.turnId)).toMatchObject({ status: "RESOLVED", narration: null });
      expect(temp.db.prepare("SELECT turn_id FROM active_turns").get()).toEqual({ turn_id: input.turnId });
      expect(temp.db.prepare("SELECT count(*) AS count FROM turn_events").get()).toEqual({ count: 0 });
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("rejects candidate decisions that disagree with the committed next decision", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "decision_mismatch");
      const repo = createTurnRepository(temp.db);
      const input = beginInput("decision_mismatch");
      repo.beginTurn(input);
      const plan = resolutionPlan("decision_mismatch");
      repo.persistPlan(input.turnId, plan);
      repo.persistResolutions(input.turnId, [checkResolution("decision_mismatch", plan.id)], 1);
      const { candidate, nextDecision } = committedCandidate(seeded.state, "decision_mismatch", 1);
      repo.persistProposal(input.turnId, turnProposal(nextDecision), candidate);
      const otherDecision = decision("other", 1);
      expect(() => repo.commitTurn({
        turnId: input.turnId,
        candidateStateHash: "hash",
        narration: null,
        nextDecision: otherDecision,
      })).toThrow("NEXT_DECISION_MISMATCH");
      expect(createCampaignRepository(temp.db).getCampaign(seeded.campaignId).stateVersion).toBe(0);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});
