import { describe, expect, it } from "vitest";
import { createSaveSetManifest, createSaveSetZip, exportSaveSet, extractSaveSetZip, importFullPrivateSaveSet,
  type ExportedSaveSet } from "@third-chair/engine";
import { createCampaignArchiveRepository, createCampaignRepository } from "@third-chair/storage";
import { createTempDatabase, seedCampaign } from "@third-chair/storage/test/fixtures";
import { commitPostRewindTurn, createRewindLineage, installRichState, SOURCE_PACK_HASH } from "./fixtures.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function rewriteMember(exported: ExportedSaveSet, path: string, value: unknown): Uint8Array {
  const extracted = extractSaveSetZip({ mode: "FULL_PRIVATE", archive: exported.archive });
  const payload = Object.entries(extracted).filter(([memberPath]) => memberPath !== "manifest.json")
    .map(([memberPath, bytes]) => ({ path: memberPath, bytes: memberPath === path ? encoder.encode(
      typeof value === "string" ? value : JSON.stringify(value),
    ) : bytes }));
  const manifest = createSaveSetManifest({ ...exported.manifest, members: payload });
  return createSaveSetZip({ mode: "FULL_PRIVATE", members: [
    { path: "manifest.json", bytes: encoder.encode(JSON.stringify(manifest)) }, ...payload,
  ] });
}

describe("FULL_PRIVATE SaveSet restore", () => {
  it("restores identity-bearing campaign data and every durable campaign ledger exactly", () => {
    const source = createTempDatabase();
    const destination = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_full_restore");
      installRichState(source.db, "saveset_full_restore");
      const rewind = createRewindLineage(source.db, "saveset_full_restore");
      commitPostRewindTurn(source.db, "saveset_full_restore");
      source.db.prepare("UPDATE branches SET created_at=? WHERE campaign_id=?")
        .run("2026-09-07T12:00:00.000Z", seeded.campaignId);
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
      expect(before.branches.find((branch) => branch.id === rewind.activeBranchId)).toMatchObject({
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

  it("rejects a child branch forked from an unrelated game turn", () => {
    const source = createTempDatabase();
    const destination = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_false_lineage");
      installRichState(source.db, "saveset_false_lineage");
      const rewind = createRewindLineage(source.db, "saveset_false_lineage");
      commitPostRewindTurn(source.db, "saveset_false_lineage");
      const exported = exportSaveSet({ repository: createCampaignArchiveRepository(source.db),
        campaignId: seeded.campaignId, expectedStateVersion: 2, mode: "FULL_PRIVATE" });
      const extracted = extractSaveSetZip({ mode: "FULL_PRIVATE", archive: exported.archive });
      const branches = JSON.parse(decoder.decode(extracted["branches.json"])) as Array<Record<string, unknown>>;
      const child = branches.find((branch) => branch.id === rewind.activeBranchId)!;
      child.fork_turn_id = "test_turn_after_rewind_saveset_false_lineage";
      const malformed = rewriteMember(exported, "branches.json", branches);

      expect(() => importFullPrivateSaveSet({ archive: malformed,
        expectedSourcePackManifestHash: SOURCE_PACK_HASH,
        destination: createCampaignArchiveRepository(destination.db), apply: true }))
        .toThrow("SAVESET_BRANCH_LINEAGE_INVALID");
    } finally {
      source.close(); source.cleanup(); destination.close(); destination.cleanup();
    }
  });

  it("rejects a committed event whose payload hash is not its candidate state hash", () => {
    const source = createTempDatabase();
    const destination = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_false_commit_hash");
      installRichState(source.db, "saveset_false_commit_hash");
      createRewindLineage(source.db, "saveset_false_commit_hash");
      commitPostRewindTurn(source.db, "saveset_false_commit_hash");
      const exported = exportSaveSet({ repository: createCampaignArchiveRepository(source.db),
        campaignId: seeded.campaignId, expectedStateVersion: 2, mode: "FULL_PRIVATE" });
      const extracted = extractSaveSetZip({ mode: "FULL_PRIVATE", archive: exported.archive });
      const records = decoder.decode(extracted["private/turns.jsonl"]).trimEnd().split("\n")
        .map((line) => JSON.parse(line) as { recordType: string; data: Record<string, unknown> });
      const event = records.find((record) => record.recordType === "TURN_EVENT")!;
      event.data.payload_hash = "b".repeat(64);
      const malformed = rewriteMember(exported, "private/turns.jsonl",
        `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);

      expect(() => importFullPrivateSaveSet({ archive: malformed,
        expectedSourcePackManifestHash: SOURCE_PACK_HASH,
        destination: createCampaignArchiveRepository(destination.db), apply: true }))
        .toThrow("SAVESET_COMMITTED_TURN_EVENT_INVALID");
    } finally {
      source.close(); source.cleanup(); destination.close(); destination.cleanup();
    }
  });
});
