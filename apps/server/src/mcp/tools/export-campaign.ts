import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ExportCampaignInputSchema,
  ExportCampaignOutputSchema,
  type ExportCampaignInput,
} from "@third-chair/contracts";
import { exportSaveSet, sha256Bytes } from "@third-chair/engine";
import type { CampaignArchiveRepository, ExportRecord, ExportRepository } from "@third-chair/storage";
import type { ToolResult } from "../result.js";

export const EXPORT_MIME_TYPE = "application/zip" as const;
export const EXPORT_TTL_MS = 24 * 60 * 60 * 1_000;

export interface ExportCampaignDependencies {
  readonly archives: CampaignArchiveRepository;
  readonly exports: ExportRepository;
  readonly exportDirectory: string;
  readonly newExportId?: () => string;
  readonly now?: () => Date;
}

export const exportCampaignDescriptor = {
  name: "export_campaign",
  description: "Use this when Bill asks to create a portable player-safe or explicitly confirmed private campaign SaveSet.",
  inputSchema: ExportCampaignInputSchema.shape,
  outputSchema: ExportCampaignOutputSchema.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
} as const;

function result(record: ExportRecord): ToolResult {
  const output = ExportCampaignOutputSchema.parse({
    exportId: record.id,
    uri: `third-chair://exports/${record.id}`,
    mimeType: EXPORT_MIME_TYPE,
    sizeBytes: record.sizeBytes,
    sha256: record.sha256,
    expiresAt: record.expiresAt,
  });
  return {
    content: [
      { type: "text", text: `${record.mode} SaveSet exported (${record.sizeBytes} bytes).` },
      { type: "resource_link", name: `third-chair-${record.id}.zip`, uri: output.uri,
        description: `Expiring ${record.mode} campaign SaveSet`, mimeType: EXPORT_MIME_TYPE, size: record.sizeBytes },
    ],
    structuredContent: output,
    _meta: {},
  };
}

function matching(record: ExportRecord, input: ExportCampaignInput): boolean {
  return record.campaignId === input.campaignId
    && record.stateVersion === input.expectedStateVersion
    && record.mode === input.mode;
}

export function exportCampaign(
  deps: ExportCampaignDependencies,
  rawInput: ExportCampaignInput,
): ToolResult {
  const input = ExportCampaignInputSchema.parse(rawInput);
  if (input.mode === "FULL_PRIVATE" && input.confirmedSpoilers !== true) {
    throw new Error("FULL_PRIVATE_EXPORT_REQUIRES_CONFIRMATION");
  }
  const existing = deps.exports.findByRequest(input.campaignId, input.requestId);
  if (existing !== null) {
    if (!matching(existing, input)) throw new Error("EXPORT_IDEMPOTENCY_CONFLICT");
    return result(existing);
  }

  const now = (deps.now ?? (() => new Date()))();
  const exported = exportSaveSet({
    repository: deps.archives,
    campaignId: input.campaignId,
    expectedStateVersion: input.expectedStateVersion,
    mode: input.mode,
    createdAt: now.toISOString(),
  });
  const exportId = (deps.newExportId ?? randomUUID)();
  mkdirSync(deps.exportDirectory, { recursive: true });
  const finalPath = join(deps.exportDirectory, `${exportId}.zip`);
  const temporaryPath = join(deps.exportDirectory, `.${exportId}.${randomUUID()}.tmp`);
  let publishedRecord: ExportRecord | null = null;
  try {
    writeFileSync(temporaryPath, exported.archive, { flag: "wx" });
    renameSync(temporaryPath, finalPath);
    publishedRecord = deps.exports.create({
      id: exportId,
      campaignId: input.campaignId,
      stateVersion: input.expectedStateVersion,
      mode: input.mode,
      requestId: input.requestId,
      path: finalPath,
      sha256: sha256Bytes(exported.archive),
      sizeBytes: exported.archive.byteLength,
      expiresAt: new Date(now.getTime() + EXPORT_TTL_MS).toISOString(),
    });
    return result(publishedRecord);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    if (publishedRecord !== null) throw error;
    const winner = deps.exports.findByRequest(input.campaignId, input.requestId);
    rmSync(finalPath, { force: true });
    if (winner !== null) {
      if (!matching(winner, input)) throw new Error("EXPORT_IDEMPOTENCY_CONFLICT");
      return result(winner);
    }
    throw error;
  }
}
