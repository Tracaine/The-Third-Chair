import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCampaignArchiveRepository,
  createExportRepository,
} from "@third-chair/storage";
import { createTempDatabase, seedCampaign } from "@third-chair/storage/test/fixtures";
import { installRichState } from "../../../packages/engine/test/saveset/fixtures.js";
import {
  exportCampaign,
  exportCampaignDescriptor,
  loadExportResource,
} from "@third-chair/server";

describe("export_campaign", () => {
  it("requires explicit spoiler confirmation for FULL_PRIVATE", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "mcp_export_confirm");
      installRichState(temp.db, "mcp_export_confirm");
      expect(exportCampaignDescriptor.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      });
      expect(() => exportCampaign({
        archives: createCampaignArchiveRepository(temp.db),
        exports: createExportRepository(temp.db),
        exportDirectory: join(temp.directory, "exports"),
      }, {
        campaignId: seeded.campaignId,
        expectedStateVersion: 0,
        requestId: "test_request_mcp_export_confirm",
        mode: "FULL_PRIVATE",
        confirmedSpoilers: false,
      })).toThrow("FULL_PRIVATE_EXPORT_REQUIRES_CONFIRMATION");
    } finally {
      temp.close(); temp.cleanup();
    }
  });

  it("returns an expiring resource link with no filesystem path or private contents", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "mcp_export_resource");
      installRichState(temp.db, "mcp_export_resource");
      const exports = createExportRepository(temp.db);
      const result = exportCampaign({
        archives: createCampaignArchiveRepository(temp.db), exports,
        exportDirectory: join(temp.directory, "exports"),
        newExportId: () => "test_export_resource",
        now: () => new Date("2026-09-07T14:00:00.000Z"),
      }, {
        campaignId: seeded.campaignId,
        expectedStateVersion: 0,
        requestId: "test_request_mcp_export_resource",
        mode: "FULL_PRIVATE",
        confirmedSpoilers: true,
      });

      expect(result.content).toContainEqual(expect.objectContaining({
        type: "resource_link",
        uri: "third-chair://exports/test_export_resource",
        mimeType: "application/zip",
      }));
      expect(result.structuredContent).toMatchObject({
        exportId: "test_export_resource",
        uri: "third-chair://exports/test_export_resource",
        mimeType: "application/zip",
        expiresAt: "2026-09-08T14:00:00.000Z",
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(temp.directory);
      expect(serialized).not.toContain("rngSeed");
      expect(serialized).not.toContain("DIRECTOR_SECRET_SENTINEL");
      const record = exports.get("test_export_resource");
      expect(existsSync(record.path)).toBe(true);
      expect(result.structuredContent).toMatchObject({ sizeBytes: readFileSync(record.path).byteLength, sha256: record.sha256 });

      const resource = loadExportResource({ exports, exportId: record.id, ownerId: "test_owner",
        now: () => new Date("2026-09-07T15:00:00.000Z") });
      expect(resource).toMatchObject({ uri: "third-chair://exports/test_export_resource", mimeType: "application/zip" });
      expect(resource.blob).toMatch(/^[A-Za-z0-9+/]+=*$/);
    } finally {
      temp.close(); temp.cleanup();
    }
  });

  it("reuses duplicate request IDs only when campaign, version, and mode match", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "mcp_export_idempotent");
      installRichState(temp.db, "mcp_export_idempotent");
      const deps = {
        archives: createCampaignArchiveRepository(temp.db),
        exports: createExportRepository(temp.db),
        exportDirectory: join(temp.directory, "exports"),
        newExportId: () => "test_export_idempotent",
        now: () => new Date("2026-09-07T14:00:00.000Z"),
      };
      const input = { campaignId: seeded.campaignId, expectedStateVersion: 0,
        requestId: "test_request_mcp_export_idempotent", mode: "PLAYER_SAFE" as const, confirmedSpoilers: false };
      const first = exportCampaign(deps, input);
      const second = exportCampaign({ ...deps, newExportId: () => "test_export_must_not_exist" }, input);
      expect(second).toEqual(first);
      expect(temp.db.prepare("SELECT COUNT(*) AS count FROM exports").get()).toEqual({ count: 1 });
      expect(() => exportCampaign(deps, { ...input, mode: "FULL_PRIVATE", confirmedSpoilers: true }))
        .toThrow("EXPORT_IDEMPOTENCY_CONFLICT");
    } finally {
      temp.close(); temp.cleanup();
    }
  });
});
