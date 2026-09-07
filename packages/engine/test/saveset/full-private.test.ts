import { describe, expect, it } from "vitest";
import { exportSaveSet, importFullPrivateSaveSet } from "@third-chair/engine";
import { createCampaignArchiveRepository, createCampaignRepository } from "@third-chair/storage";
import { createTempDatabase, seedCampaign } from "@third-chair/storage/test/fixtures";
import { commitPostRewindTurn, createRewindLineage, installRichState, SOURCE_PACK_HASH } from "./fixtures.js";

describe("FULL_PRIVATE SaveSet restore", () => {
  it("restores identity-bearing campaign data and every durable campaign ledger exactly", () => {
    const source = createTempDatabase();
    const destination = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_full_restore");
      installRichState(source.db, "saveset_full_restore");
      const rewind = createRewindLineage(source.db, "saveset_full_restore");
      commitPostRewindTurn(source.db, "saveset_full_restore");
      const sourceArchive = createCampaignArchiveRepository(source.db);
      const before = sourceArchive.readCampaign(seeded.campaignId);
      const exported = exportSaveSet({ repository: sourceArchive, campaignId: seeded.campaignId,
        expectedStateVersion: 2, mode: "FULL_PRIVATE", createdAt: "2026-09-07T13:00:00.000Z" });

      const result = importFullPrivateSaveSet({ archive: exported.archive,
        expectedSourcePackManifestHash: SOURCE_PACK_HASH,
        destination: createCampaignArchiveRepository(destination.db), apply: true });

      expect(result).toMatchObject({ applied: true, campaignId: seeded.campaignId });
      expect(createCampaignArchiveRepository(destination.db).readCampaign(seeded.campaignId)).toEqual(before);
      expect(createCampaignRepository(destination.db).getCampaign(seeded.campaignId)).toMatchObject({
        id: seeded.campaignId,
        stateVersion: 2,
        currentStateHash: before.campaign.currentStateHash,
        sourcePackHash: SOURCE_PACK_HASH,
        activeBranchId: rewind.activeBranchId,
      });
      expect(before.campaign.rngSeedBase64).toBe(Buffer.alloc(32, 7).toString("base64"));
      expect(JSON.parse(before.campaign.currentStateJson).metadata.rngCounter).toBe(1);
      expect(before.turns).toHaveLength(2);
      expect(before.turnEvents).toHaveLength(2);
      expect(before.branches).toHaveLength(2);
      expect(before.branches[1]).toMatchObject({
        parent_branch_id: seeded.rootBranchId,
        fork_turn_id: `test_turn_rewind_saveset_full_restore`,
      });
    } finally {
      source.close(); source.cleanup(); destination.close(); destination.cleanup();
    }
  });

  it("rejects an existing archived campaign ID", () => {
    const source = createTempDatabase();
    const destination = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_existing_id");
      installRichState(source.db, "saveset_existing_id");
      seedCampaign(destination.db, "saveset_existing_id");
      const exported = exportSaveSet({ repository: createCampaignArchiveRepository(source.db),
        campaignId: seeded.campaignId, expectedStateVersion: 0, mode: "FULL_PRIVATE" });

      expect(() => importFullPrivateSaveSet({ archive: exported.archive,
        expectedSourcePackManifestHash: SOURCE_PACK_HASH,
        destination: createCampaignArchiveRepository(destination.db), apply: true }))
        .toThrow("SAVESET_CAMPAIGN_ALREADY_EXISTS");
    } finally {
      source.close(); source.cleanup(); destination.close(); destination.cleanup();
    }
  });
});
