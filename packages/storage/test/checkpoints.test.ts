import { describe, expect, it } from "vitest";
import * as storage from "@third-chair/storage";
import { createTempDatabase, seedCampaign, worldState } from "./fixtures.js";

type CheckpointFactory = (db: ReturnType<typeof storage.openCampaignDatabase>) => {
  createNamed(input: {
    checkpointId: string;
    campaignId: string;
    requestId: string;
    expectedStateVersion: number;
    label: string;
    createdAt?: string;
  }): { id: string; label: string; stateVersion: number; state: unknown };
  list(campaignId: string): readonly { id: string; label: string; reason: string; stateVersion: number }[];
};

function checkpointFactory(): CheckpointFactory | undefined {
  return (storage as unknown as { createCheckpointRepository?: CheckpointFactory }).createCheckpointRepository;
}

describe("checkpoint storage", () => {
  it("rolls back campaign creation when Campaign Start would preserve a false state hash", () => {
    const temp = createTempDatabase();
    try {
      const state = worldState("false_start_hash");
      expect(() => storage.createCampaignRepository(temp.db).createCampaign({
        id: state.metadata.campaignId,
        ownerId: "test_owner",
        name: "False hash",
        sourcePackHash: "source-pack-hash",
        rngSeed: new Uint8Array(32),
        currentState: state,
        currentStateHash: "not-the-state-hash",
        rootBranchId: "test_branch_false_start_hash",
        rootBranchLabel: "Main",
      })).toThrow("CHECKPOINT_STATE_HASH_MISMATCH");
      expect(temp.db.prepare("SELECT id FROM campaigns WHERE id=?").get(state.metadata.campaignId)).toBeUndefined();
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("creates an immutable Campaign Start checkpoint with every new campaign", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "campaign_start");
      const factory = checkpointFactory();
      expect(factory).toBeTypeOf("function");
      if (!factory) return;

      expect(factory(temp.db).list(seeded.campaignId)).toMatchObject([{
        label: "Campaign Start",
        reason: "CAMPAIGN_START",
        stateVersion: 0,
      }]);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("returns the same named checkpoint for one request and rejects a duplicate label", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "named");
      const factory = checkpointFactory();
      expect(factory).toBeTypeOf("function");
      if (!factory) return;
      const checkpoints = factory(temp.db);
      const input = {
        checkpointId: "test_checkpoint_named",
        campaignId: seeded.campaignId,
        requestId: "test_checkpoint_request_named",
        expectedStateVersion: 0,
        label: "Before the bridge",
        createdAt: "2026-08-27T12:03:00.000Z",
      };

      const created = checkpoints.createNamed(input);
      expect(checkpoints.createNamed(input)).toEqual(created);
      expect(created).toMatchObject({
        id: input.checkpointId,
        label: input.label,
        stateVersion: 0,
        state: seeded.state,
      });
      expect(() => checkpoints.createNamed({
        ...input,
        checkpointId: "test_checkpoint_duplicate_label",
        requestId: "test_checkpoint_request_duplicate_label",
      })).toThrow("CHECKPOINT_LABEL_CONFLICT");
      expect(() => checkpoints.createNamed({ ...input, label: "Changed label" }))
        .toThrow("CHECKPOINT_IDEMPOTENCY_CONFLICT");
    } finally {
      temp.close();
      temp.cleanup();
    }
  });
});
