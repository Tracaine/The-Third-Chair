import { describe, expect, it } from "vitest";
import { createSaveSetZip, exportSaveSet, extractSaveSetZip, importFullPrivateSaveSet } from "@third-chair/engine";
import { createCampaignArchiveRepository } from "@third-chair/storage";
import { createTempDatabase, seedCampaign } from "@third-chair/storage/test/fixtures";
import { installRichState, SOURCE_PACK_HASH } from "./fixtures.js";

describe("SaveSet import validation", () => {
  it("rejects PLAYER_SAFE archives before destination writes", () => {
    const source = createTempDatabase();
    const destination = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_import_safe");
      installRichState(source.db, "saveset_import_safe");
      const exported = exportSaveSet({ repository: createCampaignArchiveRepository(source.db),
        campaignId: seeded.campaignId, expectedStateVersion: 0, mode: "PLAYER_SAFE" });

      expect(() => importFullPrivateSaveSet({ archive: exported.archive,
        expectedSourcePackManifestHash: SOURCE_PACK_HASH,
        destination: createCampaignArchiveRepository(destination.db), apply: true }))
        .toThrow("SAVESET_IMPORT_PLAYER_SAFE_UNSUPPORTED");
      expect(destination.db.prepare("SELECT COUNT(*) AS count FROM campaigns").get()).toEqual({ count: 0 });
    } finally {
      source.close(); source.cleanup(); destination.close(); destination.cleanup();
    }
  });

  it("rejects a member altered after manifest creation", () => {
    const source = createTempDatabase();
    const destination = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_import_tamper");
      installRichState(source.db, "saveset_import_tamper");
      const exported = exportSaveSet({ repository: createCampaignArchiveRepository(source.db),
        campaignId: seeded.campaignId, expectedStateVersion: 0, mode: "FULL_PRIVATE" });
      const members = extractSaveSetZip({ mode: "FULL_PRIVATE", archive: exported.archive });
      const tampered = createSaveSetZip({ mode: "FULL_PRIVATE", members: Object.entries(members).map(([path, bytes]) => ({
        path, bytes: path === "rulings.json" ? new TextEncoder().encode("[]") : bytes,
      })) });

      expect(() => importFullPrivateSaveSet({ archive: tampered,
        expectedSourcePackManifestHash: SOURCE_PACK_HASH,
        destination: createCampaignArchiveRepository(destination.db), apply: true }))
        .toThrow(/SAVESET_MANIFEST_MEMBER_(?:SIZE|HASH)_MISMATCH:rulings.json/);
      expect(destination.db.prepare("SELECT COUNT(*) AS count FROM campaigns").get()).toEqual({ count: 0 });
    } finally {
      source.close(); source.cleanup(); destination.close(); destination.cleanup();
    }
  });

  it("requires the current source-pack manifest hash exactly", () => {
    const source = createTempDatabase();
    const destination = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_import_source_hash");
      installRichState(source.db, "saveset_import_source_hash");
      const exported = exportSaveSet({ repository: createCampaignArchiveRepository(source.db),
        campaignId: seeded.campaignId, expectedStateVersion: 0, mode: "FULL_PRIVATE" });
      expect(() => importFullPrivateSaveSet({ archive: exported.archive,
        expectedSourcePackManifestHash: "b".repeat(64),
        destination: createCampaignArchiveRepository(destination.db), apply: true }))
        .toThrow("SAVESET_SOURCE_PACK_HASH_MISMATCH");
      expect(destination.db.prepare("SELECT COUNT(*) AS count FROM campaigns").get()).toEqual({ count: 0 });
    } finally {
      source.close(); source.cleanup(); destination.close(); destination.cleanup();
    }
  });
});
