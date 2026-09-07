import { readFileSync } from "node:fs";
import { sha256Bytes } from "@third-chair/engine";
import type { ExportRepository } from "@third-chair/storage";
import { EXPORT_MIME_TYPE } from "./tools/export-campaign.js";

export const EXPORT_RESOURCE_TEMPLATE = "third-chair://exports/{exportId}" as const;

export interface LoadExportResourceInput {
  readonly exports: ExportRepository;
  readonly exportId: string;
  readonly ownerId: string;
  readonly now?: () => Date;
}

export function loadExportResource(input: LoadExportResourceInput) {
  const record = input.exports.get(input.exportId);
  if (record.ownerId !== input.ownerId) throw new Error("EXPORT_OWNER_MISMATCH");
  if ((input.now ?? (() => new Date()))().getTime() >= Date.parse(record.expiresAt)) throw new Error("EXPORT_EXPIRED");
  const bytes = readFileSync(record.path);
  if (bytes.byteLength !== record.sizeBytes || sha256Bytes(bytes) !== record.sha256) {
    throw new Error("EXPORT_ARTIFACT_INTEGRITY_FAILED");
  }
  return {
    uri: `third-chair://exports/${record.id}`,
    mimeType: EXPORT_MIME_TYPE,
    blob: bytes.toString("base64"),
  };
}
