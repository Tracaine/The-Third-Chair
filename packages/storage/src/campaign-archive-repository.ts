import type { DatabaseSync } from "node:sqlite";
import type {
  ArchiveCampaignRow,
  ArchiveRow,
  CampaignArchiveRepository,
  CampaignArchiveSnapshot,
  CampaignId,
  CampaignStatus,
} from "./types.js";

interface CampaignSqlRow {
  id: string;
  owner_id: string;
  name: string;
  source_pack_hash: string;
  rng_seed: Uint8Array;
  state_version: number;
  current_state_json: string;
  current_state_hash: string;
  current_decision_json: string;
  active_branch_id: string;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

const columns = {
  branches: ["id", "campaign_id", "parent_branch_id", "fork_turn_id", "label", "status", "created_at"],
  turns: ["id", "campaign_id", "branch_id", "client_request_id", "expected_state_version", "decision_id",
    "input_hash", "status", "before_state_json", "before_state_hash", "locked_intents_json", "model_profile_json",
    "resolution_plan_json", "resolutions_json", "director_proposal_json", "candidate_state_json", "narration_json",
    "next_decision_json", "error_json", "committed_state_version", "created_at", "updated_at", "kind"],
  turn_events: ["sequence", "turn_id", "status", "payload_hash", "created_at"],
  active_turns: ["campaign_id", "turn_id", "reserved_state_version", "reserved_decision_id", "reserved_at"],
  turn_recovery_commands: ["id", "campaign_id", "turn_id", "client_request_id", "decision_id",
    "expected_state_version", "input_hash", "status", "result_json", "created_at", "updated_at"],
  checkpoints: ["id", "campaign_id", "branch_id", "request_id", "state_version", "label", "reason",
    "state_json", "state_hash", "rng_counter", "created_at"],
  journals: ["campaign_id", "state_version", "audience", "journal_json", "journal_hash", "created_at"],
  campaign_creation_requests: ["request_id", "owner_id", "input_hash", "status", "campaign_id", "error_json",
    "created_at", "updated_at"],
} as const;

function rows(db: DatabaseSync, sql: string, campaignId: string): ArchiveRow[] {
  return db.prepare(sql).all(campaignId).map((row) => ({ ...(row as ArchiveRow) }));
}

function campaignRow(row: CampaignSqlRow): ArchiveCampaignRow {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    sourcePackHash: row.source_pack_hash,
    rngSeedBase64: Buffer.from(row.rng_seed).toString("base64"),
    stateVersion: row.state_version,
    currentStateJson: row.current_state_json,
    currentStateHash: row.current_state_hash,
    currentDecisionJson: row.current_decision_json,
    activeBranchId: row.active_branch_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function insertRows(
  db: DatabaseSync,
  table: keyof typeof columns,
  records: readonly ArchiveRow[],
): void {
  const names = columns[table];
  if (records.length === 0) return;
  const statement = db.prepare(`INSERT INTO ${table}(${names.join(",")}) VALUES(${names.map(() => "?").join(",")})`);
  for (const record of records) statement.run(...names.map((name) => record[name] ?? null));
}

class SqliteCampaignArchiveRepository implements CampaignArchiveRepository {
  constructor(private readonly db: DatabaseSync) {}

  readCampaign(campaignId: CampaignId): CampaignArchiveSnapshot {
    const campaign = this.db.prepare("SELECT * FROM campaigns WHERE id=?").get(campaignId) as CampaignSqlRow | undefined;
    if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
    return {
      campaign: campaignRow(campaign),
      branches: rows(this.db, "SELECT * FROM branches WHERE campaign_id=? ORDER BY created_at,id", campaignId),
      turns: rows(this.db, "SELECT * FROM turns WHERE campaign_id=? ORDER BY created_at,id", campaignId),
      turnEvents: rows(this.db, `SELECT e.* FROM turn_events e JOIN turns t ON t.id=e.turn_id
        WHERE t.campaign_id=? ORDER BY e.sequence`, campaignId),
      activeTurns: rows(this.db, "SELECT * FROM active_turns WHERE campaign_id=? ORDER BY turn_id", campaignId),
      recoveryCommands: rows(this.db, "SELECT * FROM turn_recovery_commands WHERE campaign_id=? ORDER BY created_at,id", campaignId),
      checkpoints: rows(this.db, "SELECT * FROM checkpoints WHERE campaign_id=? ORDER BY state_version,created_at,id", campaignId),
      journals: rows(this.db, "SELECT * FROM journals WHERE campaign_id=? ORDER BY state_version,audience", campaignId),
      creationRequests: rows(this.db, "SELECT * FROM campaign_creation_requests WHERE campaign_id=? ORDER BY created_at,request_id", campaignId),
    };
  }

  assertEmptyForRestore(campaignId: CampaignId): void {
    if (this.db.prepare("SELECT 1 FROM campaigns WHERE id=?").get(campaignId)) {
      throw new Error("SAVESET_CAMPAIGN_ALREADY_EXISTS");
    }
    if (this.db.prepare("SELECT 1 FROM campaigns LIMIT 1").get()) {
      throw new Error("SAVESET_DESTINATION_NOT_EMPTY");
    }
    if (this.db.prepare("SELECT 1 FROM campaign_creation_requests LIMIT 1").get()) {
      throw new Error("SAVESET_DESTINATION_NOT_EMPTY");
    }
  }

  restoreCampaign(snapshot: CampaignArchiveSnapshot): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertEmptyForRestore(snapshot.campaign.id);
      const campaign = snapshot.campaign;
      const seed = Buffer.from(campaign.rngSeedBase64, "base64");
      this.db.prepare(`INSERT INTO campaigns(
        id,owner_id,name,source_pack_hash,rng_seed,state_version,current_state_json,current_state_hash,
        current_decision_json,active_branch_id,status,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        campaign.id, campaign.ownerId, campaign.name, campaign.sourcePackHash, seed, campaign.stateVersion,
        campaign.currentStateJson, campaign.currentStateHash, campaign.currentDecisionJson, campaign.activeBranchId,
        campaign.status, campaign.createdAt, campaign.updatedAt,
      );
      insertRows(this.db, "branches", snapshot.branches);
      insertRows(this.db, "turns", snapshot.turns);
      insertRows(this.db, "turn_events", snapshot.turnEvents);
      insertRows(this.db, "active_turns", snapshot.activeTurns);
      insertRows(this.db, "turn_recovery_commands", snapshot.recoveryCommands);
      insertRows(this.db, "checkpoints", snapshot.checkpoints);
      insertRows(this.db, "journals", snapshot.journals);
      insertRows(this.db, "campaign_creation_requests", snapshot.creationRequests);
      this.db.exec("COMMIT");
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function createCampaignArchiveRepository(db: DatabaseSync): CampaignArchiveRepository {
  return new SqliteCampaignArchiveRepository(db);
}
