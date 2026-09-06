import { DecisionRequestSchema, WorldStateSchema } from "@third-chair/contracts";
import type { DatabaseSync } from "node:sqlite";
import type {
  CampaignId,
  CampaignRecord,
  CampaignRepository,
  CampaignStatus,
  CreateCampaignInput,
} from "./types.js";

interface CampaignRow {
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

function parseCampaign(db: DatabaseSync, row: CampaignRow): CampaignRecord {
  const currentState = WorldStateSchema.parse(JSON.parse(row.current_state_json));
  const currentDecision = DecisionRequestSchema.parse(JSON.parse(row.current_decision_json));
  if (currentState.metadata.campaignId !== row.id) throw new Error("CAMPAIGN_STATE_ID_MISMATCH");
  if (currentState.metadata.stateVersion !== row.state_version) {
    throw new Error("CAMPAIGN_STATE_VERSION_MISMATCH");
  }
  if (currentDecision.stateVersion !== row.state_version) {
    throw new Error("CAMPAIGN_DECISION_VERSION_MISMATCH");
  }
  if (JSON.stringify(currentState.currentDecision) !== JSON.stringify(currentDecision)) {
    throw new Error("CAMPAIGN_DECISION_MISMATCH");
  }
  const branch = db.prepare(
    "SELECT campaign_id FROM branches WHERE id = ?",
  ).get(row.active_branch_id) as { campaign_id: string } | undefined;
  if (branch?.campaign_id !== row.id) throw new Error("ACTIVE_BRANCH_OWNERSHIP_MISMATCH");
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    sourcePackHash: row.source_pack_hash,
    rngSeed: new Uint8Array(row.rng_seed),
    stateVersion: row.state_version,
    currentState,
    currentStateHash: row.current_state_hash,
    currentDecision,
    activeBranchId: row.active_branch_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SqliteCampaignRepository implements CampaignRepository {
  constructor(private readonly db: DatabaseSync) {}

  createCampaign(input: CreateCampaignInput): CampaignRecord {
    const state = WorldStateSchema.parse(input.currentState);
    const decision = DecisionRequestSchema.parse(state.currentDecision);
    if (state.metadata.campaignId !== input.id) throw new Error("CAMPAIGN_STATE_ID_MISMATCH");
    if (state.metadata.stateVersion !== decision.stateVersion) {
      throw new Error("CAMPAIGN_DECISION_VERSION_MISMATCH");
    }
    if (input.rngSeed.byteLength !== 32) throw new Error("RNG_SEED_MUST_BE_32_BYTES");
    if (input.currentStateHash.length === 0) throw new Error("STATE_HASH_REQUIRED");
    const now = input.createdAt ?? new Date().toISOString();

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`
        INSERT INTO campaigns(
          id, owner_id, name, source_pack_hash, rng_seed, state_version,
          current_state_json, current_state_hash, current_decision_json,
          active_branch_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.id,
        input.ownerId,
        input.name,
        input.sourcePackHash,
        input.rngSeed,
        state.metadata.stateVersion,
        JSON.stringify(state),
        input.currentStateHash,
        JSON.stringify(decision),
        input.rootBranchId,
        input.status ?? "ACTIVE",
        now,
        now,
      );
      this.db.prepare(`
        INSERT INTO branches(id, campaign_id, parent_branch_id, fork_turn_id, label, status, created_at)
        VALUES (?, ?, NULL, NULL, ?, 'ACTIVE', ?)
      `).run(input.rootBranchId, input.id, input.rootBranchLabel, now);
      const branch = this.db.prepare(
        "SELECT campaign_id FROM branches WHERE id = ?",
      ).get(input.rootBranchId) as { campaign_id: string } | undefined;
      if (branch?.campaign_id !== input.id) throw new Error("ACTIVE_BRANCH_OWNERSHIP_MISMATCH");
      this.db.exec("COMMIT");
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getCampaign(input.id);
  }

  getCampaign(campaignId: CampaignId): CampaignRecord {
    const row = this.db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as
      | CampaignRow
      | undefined;
    if (!row) throw new Error("CAMPAIGN_NOT_FOUND");
    return parseCampaign(this.db, row);
  }

  listCampaigns(): readonly CampaignRecord[] {
    const rows = this.db.prepare("SELECT * FROM campaigns ORDER BY updated_at DESC, id").all() as unknown as CampaignRow[];
    return rows.map((row) => parseCampaign(this.db, row));
  }
}

export function createCampaignRepository(db: DatabaseSync): CampaignRepository {
  return new SqliteCampaignRepository(db);
}
