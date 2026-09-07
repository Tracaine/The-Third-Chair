import { describe, expect, it } from "vitest";
import * as engine from "@third-chair/engine";
import {
  createCampaignRepository,
  createCheckpointRepository,
  createTurnRepository,
} from "@third-chair/storage";
import {
  billIntent,
  createTempDatabase,
  decision,
  resolutionPlan,
  seedCampaign,
  turnProposal,
} from "@third-chair/storage/test/fixtures";
import type { WorldState } from "@third-chair/contracts";

type Rewind = (deps: Record<string, unknown>, input: Record<string, unknown>) => {
  checkpoint: { id: string; stateVersion: number };
  abandonedBranchId: string;
  activeBranchId: string;
  stateVersion: number;
  currentDecision: { id: string };
  currentStateHash: string;
};

function rewindFunction(): Rewind | undefined {
  return (engine as unknown as { rewindToCheckpoint?: Rewind }).rewindToCheckpoint;
}

function commitNoCheck(
  temp: ReturnType<typeof createTempDatabase>,
  campaignId: string,
  branchId: string,
  suffix: string,
  expectedStateVersion: number,
  rngCounter: number,
): WorldState {
  const campaigns = createCampaignRepository(temp.db);
  const turns = createTurnRepository(temp.db);
  const campaign = campaigns.getCampaign(campaignId);
  const turnId = `test_turn_${suffix}`;
  turns.beginTurn({
    turnId,
    campaignId,
    branchId,
    clientRequestId: `test_request_${suffix}`,
    expectedStateVersion,
    decisionId: campaign.currentDecision.id,
    inputHash: `input-hash-${suffix}`,
    lockedIntents: [billIntent],
  });
  turns.persistNoCheckResolution(turnId, rngCounter);
  const nextDecision = decision(`${suffix}_next`, expectedStateVersion + 1);
  const candidate = {
    ...structuredClone(campaign.currentState),
    metadata: {
      ...campaign.currentState.metadata,
      stateVersion: expectedStateVersion + 1,
      turnNumber: campaign.currentState.metadata.turnNumber + 1,
      rngCounter,
    },
    currentDecision: nextDecision,
  } as WorldState;
  turns.persistProposal(turnId, turnProposal(nextDecision), candidate);
  turns.commitTurn({
    turnId,
    candidateStateHash: engine.sha256Json(candidate),
    narration: { sceneText: `Future ${expectedStateVersion + 1}` },
    nextDecision,
  });
  return candidate;
}

describe("branch-preserving rewind", () => {
  it("rejects stale versions, preserves the old future, and restores deterministic replay", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "rewind");
      commitNoCheck(temp, seeded.campaignId, seeded.rootBranchId, "rewind_one", 0, 1);
      commitNoCheck(temp, seeded.campaignId, seeded.rootBranchId, "rewind_two", 1, 2);
      const campaignStart = createCheckpointRepository(temp.db).list(seeded.campaignId)[0]!;
      const rewind = rewindFunction();
      expect(rewind).toBeTypeOf("function");
      if (!rewind) return;
      const deps = {
        campaigns: createCampaignRepository(temp.db),
        checkpoints: createCheckpointRepository(temp.db),
        newTurnId: () => "test_turn_rewind_command",
        newBranchId: () => "test_branch_rewound",
        newDecisionId: () => "test_decision_rewound",
      };
      const input = {
        campaignId: seeded.campaignId,
        checkpointId: campaignStart.id,
        requestId: "test_request_rewind_command",
        expectedStateVersion: 2,
        confirmed: true,
      };

      expect(() => rewind(deps, { ...input, expectedStateVersion: 1 }))
        .toThrow("STATE_VERSION_CONFLICT");
      expect(temp.db.prepare("SELECT status FROM branches WHERE id = ?").get(seeded.rootBranchId))
        .toEqual({ status: "ACTIVE" });

      const result = rewind(deps, input);
      expect(rewind(deps, input)).toEqual(result);
      expect(result).toMatchObject({
        checkpoint: { id: campaignStart.id, stateVersion: 0 },
        abandonedBranchId: seeded.rootBranchId,
        activeBranchId: "test_branch_rewound",
        stateVersion: 3,
        currentDecision: { id: "test_decision_rewound" },
      });

      const campaign = createCampaignRepository(temp.db).getCampaign(seeded.campaignId);
      expect(campaign.currentState.metadata).toMatchObject({ stateVersion: 3, turnNumber: 0, rngCounter: 0 });
      expect(campaign.currentState.currentDecision).toEqual(result.currentDecision);
      expect(campaign.currentStateHash).toBe(result.currentStateHash);
      expect(temp.db.prepare("SELECT id, parent_branch_id, fork_turn_id, status FROM branches ORDER BY id").all())
        .toEqual([
          { id: "test_branch_rewind", parent_branch_id: null, fork_turn_id: null, status: "ABANDONED" },
          { id: "test_branch_rewound", parent_branch_id: seeded.rootBranchId, fork_turn_id: "test_turn_rewind_command", status: "ACTIVE" },
        ]);
      expect(temp.db.prepare("SELECT kind, status, committed_state_version FROM turns ORDER BY created_at, id").all())
        .toContainEqual({ kind: "REWIND", status: "COMMITTED", committed_state_version: 3 });
      expect(createTurnRepository(temp.db).getTurn("test_turn_rewind_command")).toMatchObject({ kind: "REWIND" });
      expect(temp.db.prepare("SELECT count(*) AS count FROM turns WHERE kind = 'GAME'").get()).toEqual({ count: 2 });

      const plan = resolutionPlan("rewind_replay");
      const firstRoll = engine.resolvePlan(new Uint8Array(32).fill(7), seeded.campaignId, 0, plan);
      const replayedRoll = engine.resolvePlan(campaign.rngSeed, seeded.campaignId, campaign.currentState.metadata.rngCounter, plan);
      expect(replayedRoll).toEqual(firstRoll);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});
