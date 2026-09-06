import type { DatabaseSync } from "node:sqlite";
import { createCampaignRepository, insertCampaignRows } from "./campaign-repository.js";
import type {
  BeginCampaignCreationResult,
  CampaignCreationRepository,
  CampaignCreationRequestRecord,
  CampaignCreationStatus,
  CreateCampaignInput,
  JsonValue,
  TurnFailure,
} from "./types.js";

interface CreationRow {
  request_id: string; owner_id: string; input_hash: string; status: CampaignCreationStatus;
  campaign_id: string | null; error_json: string | null; created_at: string; updated_at: string;
}

function parse(row: CreationRow): CampaignCreationRequestRecord {
  return { requestId: row.request_id, ownerId: row.owner_id, inputHash: row.input_hash,
    status: row.status, campaignId: row.campaign_id,
    error: row.error_json === null ? null : JSON.parse(row.error_json) as JsonValue,
    createdAt: row.created_at, updatedAt: row.updated_at };
}

class SqliteCampaignCreationRepository implements CampaignCreationRepository {
  constructor(private readonly db: DatabaseSync) {}

  begin(input: { requestId: string; ownerId: string; inputHash: string; createdAt?: string }): BeginCampaignCreationResult {
    const existing = this.find(input.requestId);
    if (existing) {
      if (existing.inputHash !== input.inputHash || existing.ownerId !== input.ownerId) throw new Error("CAMPAIGN_CREATION_IDEMPOTENCY_CONFLICT");
      if (existing.status === "FAILED") {
        const now = input.createdAt ?? new Date().toISOString();
        this.db.prepare("UPDATE campaign_creation_requests SET status='PROCESSING',campaign_id=NULL,error_json=NULL,updated_at=? WHERE request_id=?")
          .run(now, input.requestId);
        return { kind: "STARTED", request: this.get(input.requestId) };
      }
      return { kind: "EXISTING", request: existing };
    }
    const now = input.createdAt ?? new Date().toISOString();
    this.db.prepare(`INSERT INTO campaign_creation_requests(request_id,owner_id,input_hash,status,campaign_id,error_json,created_at,updated_at)
      VALUES(?,?,?,'PROCESSING',NULL,NULL,?,?)`).run(input.requestId, input.ownerId, input.inputHash, now, now);
    return { kind: "STARTED", request: this.get(input.requestId) };
  }

  commit(requestId: string, inputHash: string, campaign: CreateCampaignInput) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const request = this.get(requestId);
      if (request.inputHash !== inputHash) throw new Error("CAMPAIGN_CREATION_IDEMPOTENCY_CONFLICT");
      if (request.status !== "PROCESSING") throw new Error("CAMPAIGN_CREATION_NOT_PROCESSING");
      insertCampaignRows(this.db, campaign);
      const now = campaign.createdAt ?? new Date().toISOString();
      this.db.prepare("UPDATE campaign_creation_requests SET status='COMMITTED',campaign_id=?,error_json=NULL,updated_at=? WHERE request_id=?")
        .run(campaign.id, now, requestId);
      this.db.exec("COMMIT");
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
    return createCampaignRepository(this.db).getCampaign(campaign.id);
  }

  fail(requestId: string, inputHash: string, error: TurnFailure, failedAt = new Date().toISOString()) {
    const request = this.get(requestId);
    if (request.inputHash !== inputHash) throw new Error("CAMPAIGN_CREATION_IDEMPOTENCY_CONFLICT");
    if (request.status === "COMMITTED") return request;
    this.db.prepare("UPDATE campaign_creation_requests SET status='FAILED',campaign_id=NULL,error_json=?,updated_at=? WHERE request_id=?")
      .run(JSON.stringify(error), failedAt, requestId);
    return this.get(requestId);
  }

  get(requestId: string) {
    const row = this.find(requestId);
    if (!row) throw new Error("CAMPAIGN_CREATION_REQUEST_NOT_FOUND");
    return row;
  }

  private find(requestId: string): CampaignCreationRequestRecord | null {
    const row = this.db.prepare("SELECT * FROM campaign_creation_requests WHERE request_id=?").get(requestId) as CreationRow | undefined;
    return row ? parse(row) : null;
  }
}

export function createCampaignCreationRepository(db: DatabaseSync): CampaignCreationRepository {
  return new SqliteCampaignCreationRepository(db);
}
