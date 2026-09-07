import { DecisionRequestSchema, WorldStateSchema } from "@third-chair/contracts";
import type { DatabaseSync } from "node:sqlite";
import type {
  CheckpointId,
  CheckpointRecord,
  CheckpointRepository,
  CreateCheckpointSnapshotInput,
  CreateNamedCheckpointInput,
  RewindCheckpointCommitInput,
  RewindCheckpointRecord,
} from "./types.js";
import { hashStoredState } from "./state-hash.js";

interface CheckpointRow {
  id: string;
  campaign_id: string;
  branch_id: string;
  request_id: string;
  state_version: number;
  label: string;
  reason: string;
  state_json: string;
  state_hash: string;
  rng_counter: number;
  created_at: string;
}

function parseCheckpoint(row: CheckpointRow): CheckpointRecord {
  const state = WorldStateSchema.parse(JSON.parse(row.state_json));
  if (state.metadata.campaignId !== row.campaign_id) throw new Error("CHECKPOINT_STATE_CAMPAIGN_MISMATCH");
  if (state.metadata.stateVersion !== row.state_version) throw new Error("CHECKPOINT_STATE_VERSION_MISMATCH");
  if (state.metadata.rngCounter !== row.rng_counter) throw new Error("CHECKPOINT_RNG_COUNTER_MISMATCH");
  return {
    id: row.id,
    campaignId: row.campaign_id,
    branchId: row.branch_id,
    requestId: row.request_id,
    stateVersion: row.state_version,
    label: row.label,
    reason: row.reason as CheckpointRecord["reason"],
    state,
    stateHash: row.state_hash,
    rngCounter: row.rng_counter,
    createdAt: row.created_at,
  };
}

export function insertCheckpointSnapshot(db: DatabaseSync, input: CreateCheckpointSnapshotInput): void {
  const state = WorldStateSchema.parse(input.state);
  if (state.metadata.campaignId !== input.campaignId) throw new Error("CHECKPOINT_STATE_CAMPAIGN_MISMATCH");
  if (state.metadata.stateVersion !== input.stateVersion) throw new Error("CHECKPOINT_STATE_VERSION_MISMATCH");
  if (state.metadata.rngCounter !== input.rngCounter) throw new Error("CHECKPOINT_RNG_COUNTER_MISMATCH");
  if (hashStoredState(state) !== input.stateHash) throw new Error("CHECKPOINT_STATE_HASH_MISMATCH");
  db.prepare(`
    INSERT INTO checkpoints(
      id, campaign_id, branch_id, request_id, state_version, label, reason,
      state_json, state_hash, rng_counter, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.checkpointId,
    input.campaignId,
    input.branchId,
    input.requestId,
    input.stateVersion,
    input.label,
    input.reason,
    JSON.stringify(state),
    input.stateHash,
    input.rngCounter,
    input.createdAt,
  );
}

class SqliteCheckpointRepository implements CheckpointRepository {
  constructor(private readonly db: DatabaseSync) {}

  createNamed(input: CreateNamedCheckpointInput): CheckpointRecord {
    const label = input.label.trim();
    if (label.length === 0 || label.length > 200) throw new Error("INVALID_CHECKPOINT_LABEL");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.findByRequest(input.campaignId, input.requestId);
      if (existing !== null) {
        if (existing.stateVersion !== input.expectedStateVersion || existing.label !== label || existing.reason !== "NAMED") {
          throw new Error("CHECKPOINT_IDEMPOTENCY_CONFLICT");
        }
        this.db.exec("COMMIT");
        return existing;
      }
      const campaign = this.db.prepare(`
        SELECT state_version, current_state_json, current_state_hash, active_branch_id
        FROM campaigns WHERE id = ?
      `).get(input.campaignId) as {
        state_version: number;
        current_state_json: string;
        current_state_hash: string;
        active_branch_id: string;
      } | undefined;
      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.state_version !== input.expectedStateVersion) throw new Error("STATE_VERSION_CONFLICT");
      const state = WorldStateSchema.parse(JSON.parse(campaign.current_state_json));
      try {
        insertCheckpointSnapshot(this.db, {
          checkpointId: input.checkpointId,
          campaignId: input.campaignId,
          branchId: campaign.active_branch_id,
          requestId: input.requestId,
          stateVersion: campaign.state_version,
          label,
          reason: "NAMED",
          state,
          stateHash: campaign.current_state_hash,
          rngCounter: state.metadata.rngCounter,
          createdAt: input.createdAt ?? new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof Error && /checkpoints\.campaign_id, checkpoints\.branch_id, checkpoints\.label/.test(error.message)) {
          throw new Error("CHECKPOINT_LABEL_CONFLICT");
        }
        throw error;
      }
      const created = this.get(input.checkpointId);
      this.db.exec("COMMIT");
      return created;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }

  get(checkpointId: CheckpointId): CheckpointRecord {
    const row = this.db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(checkpointId) as CheckpointRow | undefined;
    if (!row) throw new Error("CHECKPOINT_NOT_FOUND");
    return parseCheckpoint(row);
  }

  list(campaignId: string): readonly CheckpointRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM checkpoints WHERE campaign_id = ?
      ORDER BY state_version ASC, created_at ASC, id ASC
    `).all(campaignId) as unknown as CheckpointRow[];
    return rows.map(parseCheckpoint);
  }

  rewind(input: RewindCheckpointCommitInput): RewindCheckpointRecord {
    const restoredState = WorldStateSchema.parse(input.restoredState);
    const nextDecision = DecisionRequestSchema.parse(input.nextDecision);
    const createdAt = input.createdAt ?? new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.db.prepare(`
        SELECT id, input_hash, status, committed_state_version,
               candidate_state_json, next_decision_json
        FROM turns WHERE campaign_id = ? AND client_request_id = ?
      `).get(input.campaignId, input.requestId) as {
        id: string;
        input_hash: string;
        status: string;
        committed_state_version: number | null;
        candidate_state_json: string | null;
        next_decision_json: string | null;
      } | undefined;
      if (existing !== undefined) {
        if (existing.input_hash !== input.inputHash) throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT");
        if (existing.status !== "COMMITTED" || existing.committed_state_version === null
          || existing.candidate_state_json === null || existing.next_decision_json === null) {
          throw new Error("REWIND_REQUEST_NOT_COMMITTED");
        }
        const branch = this.db.prepare(`
          SELECT id, parent_branch_id FROM branches WHERE campaign_id = ? AND fork_turn_id = ?
        `).get(input.campaignId, existing.id) as { id: string; parent_branch_id: string } | undefined;
        if (!branch) throw new Error("REWIND_BRANCH_NOT_FOUND");
        const state = WorldStateSchema.parse(JSON.parse(existing.candidate_state_json));
        const decision = DecisionRequestSchema.parse(JSON.parse(existing.next_decision_json));
        const stateHashRow = this.db.prepare(`
          SELECT payload_hash FROM turn_events WHERE turn_id = ? AND status = 'COMMITTED'
          ORDER BY sequence DESC LIMIT 1
        `).get(existing.id) as { payload_hash: string } | undefined;
        const checkpoint = this.get(input.checkpointId);
        this.db.exec("COMMIT");
        return {
          checkpoint,
          rewindTurnId: existing.id,
          abandonedBranchId: branch.parent_branch_id,
          activeBranchId: branch.id,
          stateVersion: existing.committed_state_version,
          currentState: state,
          currentStateHash: stateHashRow?.payload_hash ?? hashStoredState(state),
          currentDecision: decision,
        };
      }

      const campaign = this.db.prepare(`
        SELECT state_version, current_state_json, current_state_hash,
               current_decision_json, active_branch_id
        FROM campaigns WHERE id = ?
      `).get(input.campaignId) as {
        state_version: number;
        current_state_json: string;
        current_state_hash: string;
        current_decision_json: string;
        active_branch_id: string;
      } | undefined;
      if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
      if (campaign.state_version !== input.expectedStateVersion) throw new Error("STATE_VERSION_CONFLICT");
      if (this.db.prepare("SELECT 1 FROM active_turns WHERE campaign_id = ?").get(input.campaignId)) {
        throw new Error("ACTIVE_TURN_EXISTS");
      }
      const checkpoint = this.get(input.checkpointId);
      if (checkpoint.campaignId !== input.campaignId) throw new Error("CHECKPOINT_CAMPAIGN_MISMATCH");
      if (hashStoredState(checkpoint.state) !== checkpoint.stateHash) throw new Error("CHECKPOINT_HASH_MISMATCH");
      const committedVersion = campaign.state_version + 1;
      if (restoredState.metadata.campaignId !== input.campaignId
        || restoredState.metadata.stateVersion !== committedVersion
        || nextDecision.stateVersion !== committedVersion
        || JSON.stringify(restoredState.currentDecision) !== JSON.stringify(nextDecision)) {
        throw new Error("REWIND_STATE_MISMATCH");
      }
      if (restoredState.metadata.rngCounter !== checkpoint.rngCounter) throw new Error("REWIND_RNG_COUNTER_MISMATCH");
      if (hashStoredState(restoredState) !== input.restoredStateHash) throw new Error("REWIND_STATE_HASH_MISMATCH");

      const beforeState = WorldStateSchema.parse(JSON.parse(campaign.current_state_json));
      const currentDecision = DecisionRequestSchema.parse(JSON.parse(campaign.current_decision_json));
      this.db.prepare(`
        INSERT INTO turns(
          id, campaign_id, branch_id, client_request_id, expected_state_version,
          decision_id, input_hash, status, before_state_json, before_state_hash,
          locked_intents_json, resolutions_json, candidate_state_json, narration_json,
          next_decision_json, committed_state_version, created_at, updated_at, kind
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'COMMITTED', ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, 'REWIND')
      `).run(
        input.rewindTurnId,
        input.campaignId,
        campaign.active_branch_id,
        input.requestId,
        input.expectedStateVersion,
        currentDecision.id,
        input.inputHash,
        JSON.stringify(beforeState),
        campaign.current_state_hash,
        JSON.stringify({ resolutions: [], nextRngCounter: checkpoint.rngCounter }),
        JSON.stringify(restoredState),
        JSON.stringify({ kind: "TABLE_CONTROL_REWIND", checkpointId: checkpoint.id, label: checkpoint.label }),
        JSON.stringify(nextDecision),
        committedVersion,
        createdAt,
        createdAt,
      );
      const abandoned = this.db.prepare(
        "UPDATE branches SET status = 'ABANDONED' WHERE id = ? AND campaign_id = ? AND status = 'ACTIVE'",
      ).run(campaign.active_branch_id, input.campaignId);
      if (Number(abandoned.changes) !== 1) throw new Error("ACTIVE_BRANCH_MISMATCH");
      this.db.prepare(`
        INSERT INTO branches(id, campaign_id, parent_branch_id, fork_turn_id, label, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
      `).run(input.newBranchId, input.campaignId, campaign.active_branch_id, input.rewindTurnId,
        `Rewind to ${checkpoint.label}`, createdAt);
      const updated = this.db.prepare(`
        UPDATE campaigns SET state_version = ?, current_state_json = ?, current_state_hash = ?,
          current_decision_json = ?, active_branch_id = ?, updated_at = ?
        WHERE id = ? AND state_version = ? AND active_branch_id = ?
      `).run(committedVersion, JSON.stringify(restoredState), input.restoredStateHash,
        JSON.stringify(nextDecision), input.newBranchId, createdAt, input.campaignId,
        input.expectedStateVersion, campaign.active_branch_id);
      if (Number(updated.changes) !== 1) throw new Error("CAMPAIGN_COMPARE_AND_SET_FAILED");
      this.db.prepare(`
        INSERT INTO turn_events(turn_id, status, payload_hash, created_at)
        VALUES (?, 'COMMITTED', ?, ?)
      `).run(input.rewindTurnId, input.restoredStateHash, createdAt);
      this.db.exec("COMMIT");
      return {
        checkpoint,
        rewindTurnId: input.rewindTurnId,
        abandonedBranchId: campaign.active_branch_id,
        activeBranchId: input.newBranchId,
        stateVersion: committedVersion,
        currentState: restoredState,
        currentStateHash: input.restoredStateHash,
        currentDecision: nextDecision,
      };
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private findByRequest(campaignId: string, requestId: string): CheckpointRecord | null {
    const row = this.db.prepare(
      "SELECT * FROM checkpoints WHERE campaign_id = ? AND request_id = ?",
    ).get(campaignId, requestId) as CheckpointRow | undefined;
    return row ? parseCheckpoint(row) : null;
  }
}

export function createCheckpointRepository(db: DatabaseSync): CheckpointRepository {
  return new SqliteCheckpointRepository(db);
}
