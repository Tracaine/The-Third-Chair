import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { exportSaveSet } from "@third-chair/engine";
import { createCampaignArchiveRepository } from "@third-chair/storage";
import { createTempDatabase, seedCampaign } from "@third-chair/storage/test/fixtures";
import { installRichState, SOURCE_PACK_HASH } from "./fixtures.js";

describe("operator SaveSet import CLI", () => {
  it("is dry-run by default and restores the exact campaign ID only with --apply", () => {
    const source = createTempDatabase();
    try {
      const seeded = seedCampaign(source.db, "saveset_cli");
      installRichState(source.db, "saveset_cli");
      const exported = exportSaveSet({ repository: createCampaignArchiveRepository(source.db),
        campaignId: seeded.campaignId, expectedStateVersion: 0, mode: "FULL_PRIVATE" });
      const archivePath = join(source.directory, "campaign.zip");
      const sourcePackPath = join(source.directory, "source-pack.sqlite");
      const destinationPath = join(source.directory, "destination.sqlite");
      writeFileSync(archivePath, exported.archive);
      const sourcePack = new DatabaseSync(sourcePackPath);
      sourcePack.exec("CREATE TABLE source_pack_manifest(key TEXT PRIMARY KEY,value_json TEXT NOT NULL)");
      sourcePack.prepare("INSERT INTO source_pack_manifest VALUES('sourcePackManifestHash',?)")
        .run(JSON.stringify(SOURCE_PACK_HASH));
      sourcePack.close();

      const args = ["scripts/import-saveset.mjs", archivePath, "--database", destinationPath,
        "--source-pack", sourcePackPath];
      const dryRun = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8" });
      expect(dryRun.status, dryRun.stderr).toBe(0);
      expect(JSON.parse(dryRun.stdout)).toMatchObject({ status: "VALID", applied: false, campaignId: seeded.campaignId });
      expect(() => new DatabaseSync(destinationPath, { readOnly: true })).toThrow();

      const apply = spawnSync(process.execPath, [...args, "--apply"], { cwd: process.cwd(), encoding: "utf8" });
      expect(apply.status, apply.stderr).toBe(0);
      expect(JSON.parse(apply.stdout)).toMatchObject({ status: "RESTORED", applied: true, campaignId: seeded.campaignId });
      const destination = new DatabaseSync(destinationPath, { readOnly: true });
      expect(destination.prepare("SELECT id FROM campaigns").get()).toEqual({ id: seeded.campaignId });
      destination.close();
    } finally {
      source.close(); source.cleanup();
    }
  }, 20_000);
});
