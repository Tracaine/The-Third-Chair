import type { DatabaseSync } from "node:sqlite";
import type { CreateExportRecordInput, ExportRecord, ExportRepository } from "./types.js";

interface ExportRow {
  id: string; campaign_id: string; owner_id: string; state_version: number;
  mode: ExportRecord["mode"]; request_id: string; path: string; sha256: string;
  size_bytes: number; expires_at: string;
}

function parse(row: ExportRow): ExportRecord {
  return {
    id: row.id, campaignId: row.campaign_id, ownerId: row.owner_id, stateVersion: row.state_version,
    mode: row.mode, requestId: row.request_id, path: row.path, sha256: row.sha256,
    sizeBytes: row.size_bytes, expiresAt: row.expires_at,
  };
}

class SqliteExportRepository implements ExportRepository {
  constructor(private readonly db: DatabaseSync) {}

  get(exportId: string): ExportRecord {
    const row = this.db.prepare(`SELECT e.*,c.owner_id FROM exports e
      JOIN campaigns c ON c.id=e.campaign_id WHERE e.id=?`).get(exportId) as ExportRow | undefined;
    if (!row) throw new Error("EXPORT_NOT_FOUND");
    return parse(row);
  }

  findByRequest(campaignId: string, requestId: string): ExportRecord | null {
    const row = this.db.prepare(`SELECT e.*,c.owner_id FROM exports e
      JOIN campaigns c ON c.id=e.campaign_id WHERE e.campaign_id=? AND e.request_id=?`)
      .get(campaignId, requestId) as ExportRow | undefined;
    return row ? parse(row) : null;
  }

  create(input: CreateExportRecordInput): ExportRecord {
    this.db.prepare(`INSERT INTO exports(id,campaign_id,state_version,mode,request_id,path,sha256,size_bytes,expires_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(input.id, input.campaignId, input.stateVersion, input.mode, input.requestId,
        input.path, input.sha256, input.sizeBytes, input.expiresAt);
    return this.get(input.id);
  }
}

export function createExportRepository(db: DatabaseSync): ExportRepository {
  return new SqliteExportRepository(db);
}
