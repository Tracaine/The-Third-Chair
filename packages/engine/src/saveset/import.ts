import {
  ActorIntentSchema,
  CheckResolutionSchema,
  DecisionRequestSchema,
  CheckpointReasonSchema,
  JournalAudienceSchema,
  PersistedIdSchema,
  PlayerActorViewSchema,
  PlayerJournalSchema,
  ResolutionPlanSchema,
  Sha256HexSchema,
  TurnProposalSchema,
  WorldStateSchema,
  type SaveSetManifest,
} from "@third-chair/contracts";
import {
  hashStoredState,
  type ArchiveRow,
  type CampaignArchiveRepository,
  type CampaignArchiveSnapshot,
} from "@third-chair/storage";
import { z } from "zod";
import { canonicalJson } from "../canonical-json.js";
import { verifySaveSetManifestMembers } from "./manifest.js";
import { extractSaveSetZip } from "./zip.js";

const decoder = new TextDecoder("utf-8", { fatal: true });
const ScalarSchema = z.union([z.string(), z.number(), z.null()]);
const ArchiveRowSchema = z.record(z.string(), ScalarSchema);
const TimestampSchema = z.string().datetime();
const JsonTextSchema = z.string().min(1);
const HashTextSchema = z.string().min(1);
const NonnegativeIntSchema = z.number().int().nonnegative();
const CampaignStatusSchema = z.enum(["ACTIVE", "READ_ONLY", "ARCHIVED"]);
const WorldPayloadSchema = z.object({
  campaign: z.object({
    id: PersistedIdSchema, ownerId: z.string().min(1), name: z.string().min(1), sourcePackHash: Sha256HexSchema,
    stateVersion: NonnegativeIntSchema, currentStateJson: JsonTextSchema, currentStateHash: Sha256HexSchema,
    currentDecisionJson: JsonTextSchema, activeBranchId: PersistedIdSchema, status: CampaignStatusSchema,
    createdAt: TimestampSchema, updatedAt: TimestampSchema,
  }).strict(),
}).strict();
const RngPayloadSchema = z.object({ seedBase64: z.string(), counter: NonnegativeIntSchema }).strict();
const LedgerRecordSchema = z.object({
  recordType: z.enum(["TURN", "TURN_EVENT", "ACTIVE_TURN", "RECOVERY_COMMAND", "JOURNAL"]),
  data: ArchiveRowSchema,
}).strict();
const BranchRowSchema = z.object({
  id: PersistedIdSchema, campaign_id: PersistedIdSchema, parent_branch_id: PersistedIdSchema.nullable(),
  fork_turn_id: PersistedIdSchema.nullable(), label: z.string().min(1), status: z.enum(["ACTIVE", "ABANDONED"]),
  created_at: TimestampSchema,
}).strict();
const TurnRowSchema = z.object({
  id: PersistedIdSchema, campaign_id: PersistedIdSchema, branch_id: PersistedIdSchema,
  client_request_id: PersistedIdSchema, expected_state_version: NonnegativeIntSchema,
  decision_id: PersistedIdSchema, input_hash: HashTextSchema,
  status: z.enum(["PROCESSING", "PLANNED", "RESOLVED", "AWAITING_INPUT", "COMMITTED", "FAILED"]),
  before_state_json: JsonTextSchema, before_state_hash: Sha256HexSchema, locked_intents_json: JsonTextSchema,
  model_profile_json: JsonTextSchema.nullable(), resolution_plan_json: JsonTextSchema.nullable(),
  resolutions_json: JsonTextSchema.nullable(), director_proposal_json: JsonTextSchema.nullable(),
  candidate_state_json: JsonTextSchema.nullable(), narration_json: JsonTextSchema.nullable(),
  next_decision_json: JsonTextSchema.nullable(), error_json: JsonTextSchema.nullable(),
  committed_state_version: NonnegativeIntSchema.nullable(), created_at: TimestampSchema, updated_at: TimestampSchema,
  kind: z.enum(["GAME", "REWIND"]),
}).strict();
const TurnEventRowSchema = z.object({
  sequence: z.number().int().positive(), turn_id: PersistedIdSchema,
  status: z.enum(["PROCESSING", "PLANNED", "RESOLVED", "AWAITING_INPUT", "COMMITTED", "FAILED"]),
  payload_hash: Sha256HexSchema.nullable(), created_at: TimestampSchema,
}).strict();
const ActiveTurnRowSchema = z.object({
  campaign_id: PersistedIdSchema, turn_id: PersistedIdSchema, reserved_state_version: NonnegativeIntSchema,
  reserved_decision_id: PersistedIdSchema, reserved_at: TimestampSchema,
}).strict();
const RecoveryRowSchema = z.object({
  id: PersistedIdSchema, campaign_id: PersistedIdSchema, turn_id: PersistedIdSchema,
  client_request_id: PersistedIdSchema, decision_id: PersistedIdSchema,
  expected_state_version: NonnegativeIntSchema, input_hash: HashTextSchema,
  status: z.enum(["PROCESSING", "COMMITTED", "FAILED"]), result_json: JsonTextSchema.nullable(),
  created_at: TimestampSchema, updated_at: TimestampSchema,
}).strict();
const CheckpointRowSchema = z.object({
  id: PersistedIdSchema, campaign_id: PersistedIdSchema, branch_id: PersistedIdSchema,
  request_id: z.string().min(1), state_version: NonnegativeIntSchema, label: z.string().min(1),
  reason: CheckpointReasonSchema, state_json: JsonTextSchema, state_hash: Sha256HexSchema,
  rng_counter: NonnegativeIntSchema, created_at: TimestampSchema,
}).strict();
const JournalRowSchema = z.object({
  campaign_id: PersistedIdSchema, state_version: NonnegativeIntSchema, audience: JournalAudienceSchema,
  journal_json: JsonTextSchema, journal_hash: Sha256HexSchema, created_at: TimestampSchema,
}).strict();
const CreationRowSchema = z.object({
  request_id: PersistedIdSchema, owner_id: z.string().min(1), input_hash: HashTextSchema,
  status: z.enum(["PROCESSING", "COMMITTED", "FAILED"]), campaign_id: PersistedIdSchema.nullable(),
  error_json: JsonTextSchema.nullable(), created_at: TimestampSchema, updated_at: TimestampSchema,
}).strict();

export interface ImportFullPrivateSaveSetInput {
  readonly archive: Uint8Array;
  readonly expectedSourcePackManifestHash: string;
  readonly destination: CampaignArchiveRepository;
  readonly apply?: boolean;
}

export interface ImportFullPrivateSaveSetResult {
  readonly campaignId: string;
  readonly stateVersion: number;
  readonly stateHash: string;
  readonly applied: boolean;
  readonly manifest: SaveSetManifest;
}

export interface ValidateFullPrivateSaveSetInput {
  readonly archive: Uint8Array;
  readonly expectedSourcePackManifestHash: string;
}

function json(bytes: Uint8Array, code: string): unknown {
  try { return JSON.parse(decoder.decode(bytes)) as unknown; }
  catch { throw new Error(code); }
}

function typedRow<T extends ArchiveRow>(raw: unknown, schema: z.ZodType<T>, code: string): T {
  try { return schema.parse(raw); }
  catch { throw new Error(code); }
}

function rowArray<T extends ArchiveRow>(bytes: Uint8Array, schema: z.ZodType<T>, code: string): T[] {
  return z.array(z.unknown()).parse(json(bytes, code)).map((row) => typedRow(row, schema, code));
}

function parseJsonField(row: ArchiveRow, key: string, schema: z.ZodType, code: string): unknown {
  const value = row[key];
  if (typeof value !== "string") throw new Error(code);
  try { return schema.parse(JSON.parse(value)); }
  catch { throw new Error(code); }
}

function optionalJsonField(row: ArchiveRow, key: string, schema: z.ZodType, code: string): unknown | null {
  return row[key] === null ? null : parseJsonField(row, key, schema, code);
}

function validateStateHash(state: unknown, expected: unknown, code: string): void {
  if (typeof expected !== "string" || hashStoredState(state) !== expected) throw new Error(code);
}

function requireBelongs(row: ArchiveRow, campaignId: string, code: string): void {
  if (row.campaign_id !== campaignId) throw new Error(code);
}

function requireUnique(values: readonly string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

function validateBranchLineage(branches: readonly z.infer<typeof BranchRowSchema>[]): void {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const complete = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): void => {
    if (complete.has(id)) return;
    if (visiting.has(id)) throw new Error("SAVESET_BRANCH_LINEAGE_INVALID");
    const branch = byId.get(id);
    if (!branch) throw new Error("SAVESET_BRANCH_LINEAGE_INVALID");
    visiting.add(id);
    if (branch.parent_branch_id !== null) visit(branch.parent_branch_id);
    visiting.delete(id);
    complete.add(id);
  };
  for (const id of byId.keys()) visit(id);
}

function parseLedger(bytes: Uint8Array) {
  const text = decoder.decode(bytes);
  const records = text.length === 0 ? [] : text.trimEnd().split("\n").map((line) => {
    try { return LedgerRecordSchema.parse(JSON.parse(line)); }
    catch { throw new Error("SAVESET_TURN_LEDGER_INVALID"); }
  });
  return {
    turns: records.filter((record) => record.recordType === "TURN").map(({ data }) => typedRow(data, TurnRowSchema, "SAVESET_TURN_INVALID")),
    turnEvents: records.filter((record) => record.recordType === "TURN_EVENT").map(({ data }) => typedRow(data, TurnEventRowSchema, "SAVESET_TURN_EVENT_INVALID")),
    activeTurns: records.filter((record) => record.recordType === "ACTIVE_TURN").map(({ data }) => typedRow(data, ActiveTurnRowSchema, "SAVESET_ACTIVE_TURN_INVALID")),
    recoveryCommands: records.filter((record) => record.recordType === "RECOVERY_COMMAND").map(({ data }) => typedRow(data, RecoveryRowSchema, "SAVESET_RECOVERY_INVALID")),
    journals: records.filter((record) => record.recordType === "JOURNAL").map(({ data }) => typedRow(data, JournalRowSchema, "SAVESET_JOURNAL_INVALID")),
  };
}

function fullPrivateMembers(archive: Uint8Array): Readonly<Record<string, Uint8Array>> {
  try {
    return extractSaveSetZip({ mode: "FULL_PRIVATE", archive });
  } catch (privateError) {
    try {
      const safe = extractSaveSetZip({ mode: "PLAYER_SAFE", archive });
      const manifest = json(safe["manifest.json"]!, "SAVESET_MANIFEST_INVALID") as { mode?: unknown };
      if (manifest?.mode === "PLAYER_SAFE") throw new Error("SAVESET_IMPORT_PLAYER_SAFE_UNSUPPORTED");
    } catch (safeError) {
      if (safeError instanceof Error && safeError.message === "SAVESET_IMPORT_PLAYER_SAFE_UNSUPPORTED") throw safeError;
    }
    throw privateError;
  }
}

function validateArchive(archive: Uint8Array, expectedSourcePackManifestHash: string): {
  manifest: SaveSetManifest;
  snapshot: CampaignArchiveSnapshot;
} {
  const members = fullPrivateMembers(archive);
  const rawManifest = json(members["manifest.json"]!, "SAVESET_MANIFEST_INVALID");
  const payloadMembers = Object.entries(members)
    .filter(([path]) => path !== "manifest.json")
    .map(([path, bytes]) => ({ path, bytes }));
  const manifest = verifySaveSetManifestMembers(rawManifest, payloadMembers);
  if (manifest.mode !== "FULL_PRIVATE") throw new Error("SAVESET_IMPORT_PLAYER_SAFE_UNSUPPORTED");
  if (manifest.sourcePackManifestHash !== expectedSourcePackManifestHash) throw new Error("SAVESET_SOURCE_PACK_HASH_MISMATCH");

  PlayerActorViewSchema.array().parse(json(members["characters.json"]!, "SAVESET_CHARACTERS_INVALID"));
  z.array(z.string()).parse(json(members["citations.json"]!, "SAVESET_CITATIONS_INVALID"));
  if (decoder.decode(members["journal.md"]!).trim().length === 0) throw new Error("SAVESET_JOURNAL_MARKDOWN_INVALID");

  const world = WorldPayloadSchema.parse(json(members["private/world-state.json"]!, "SAVESET_WORLD_STATE_INVALID"));
  const state = WorldStateSchema.parse(JSON.parse(world.campaign.currentStateJson));
  const decision = DecisionRequestSchema.parse(JSON.parse(world.campaign.currentDecisionJson));
  const rng = RngPayloadSchema.parse(json(members["private/rng.json"]!, "SAVESET_RNG_INVALID"));
  const seed = Buffer.from(rng.seedBase64, "base64");
  if (seed.byteLength !== 32 || seed.toString("base64") !== rng.seedBase64) throw new Error("SAVESET_RNG_SEED_INVALID");

  if (world.campaign.id !== manifest.campaignId || state.metadata.campaignId !== manifest.campaignId) {
    throw new Error("SAVESET_CAMPAIGN_ID_MISMATCH");
  }
  if (world.campaign.name !== manifest.campaignName || world.campaign.sourcePackHash !== manifest.sourcePackManifestHash
    || world.campaign.stateVersion !== manifest.stateVersion || state.metadata.stateVersion !== manifest.stateVersion
    || decision.stateVersion !== manifest.stateVersion || world.campaign.currentStateHash !== manifest.stateHash
    || world.campaign.activeBranchId !== manifest.activeBranchId) throw new Error("SAVESET_CAMPAIGN_IDENTITY_MISMATCH");
  if (JSON.stringify(state.currentDecision) !== JSON.stringify(decision)) throw new Error("SAVESET_DECISION_MISMATCH");
  if (state.metadata.rngCounter !== rng.counter) throw new Error("SAVESET_RNG_COUNTER_MISMATCH");
  validateStateHash(state, world.campaign.currentStateHash, "SAVESET_STATE_HASH_MISMATCH");

  const rulings = json(members["rulings.json"]!, "SAVESET_RULINGS_INVALID");
  if (canonicalJson(rulings) !== canonicalJson(state.table.houseRules)) throw new Error("SAVESET_RULINGS_MISMATCH");

  const branches = rowArray(members["branches.json"]!, BranchRowSchema, "SAVESET_BRANCHES_INVALID");
  const branchIds = new Set<string>();
  for (const branch of branches) {
    requireBelongs(branch, manifest.campaignId, "SAVESET_BRANCH_CAMPAIGN_MISMATCH");
    if (branchIds.has(branch.id)) throw new Error("SAVESET_BRANCH_DUPLICATE");
    branchIds.add(branch.id);
  }
  validateBranchLineage(branches);
  if (!branchIds.has(manifest.activeBranchId)) throw new Error("SAVESET_ACTIVE_BRANCH_MISSING");
  if (branches.filter((branch) => branch.parent_branch_id === null).length !== 1) {
    throw new Error("SAVESET_BRANCH_LINEAGE_INVALID");
  }
  const activeBranches = branches.filter((branch) => branch.status === "ACTIVE");
  if (activeBranches.length !== 1 || activeBranches[0]!.id !== manifest.activeBranchId) {
    throw new Error("SAVESET_ACTIVE_BRANCH_INVALID");
  }

  const ledger = parseLedger(members["private/turns.jsonl"]!);
  requireUnique(ledger.turns.map((turn) => turn.id), "SAVESET_TURN_DUPLICATE");
  requireUnique(ledger.turns.map((turn) => `${turn.campaign_id}\0${turn.client_request_id}`), "SAVESET_TURN_REQUEST_DUPLICATE");
  const turnIds = new Set<string>();
  const committedCandidates = new Map<string, { state: z.infer<typeof WorldStateSchema>; hash: string }>();
  for (const turn of ledger.turns) {
    requireBelongs(turn, manifest.campaignId, "SAVESET_TURN_CAMPAIGN_MISMATCH");
    if (!branchIds.has(turn.branch_id)) throw new Error("SAVESET_TURN_IDENTITY_INVALID");
    turnIds.add(turn.id);
    const before = parseJsonField(turn, "before_state_json", WorldStateSchema,
      "SAVESET_TURN_BEFORE_STATE_INVALID") as z.infer<typeof WorldStateSchema>;
    if (before.metadata.campaignId !== manifest.campaignId || before.metadata.stateVersion !== turn.expected_state_version
      || before.currentDecision.id !== turn.decision_id) throw new Error("SAVESET_TURN_IDENTITY_INVALID");
    validateStateHash(before, turn.before_state_hash, "SAVESET_TURN_BEFORE_HASH_MISMATCH");
    parseJsonField(turn, "locked_intents_json", ActorIntentSchema.array(), "SAVESET_TURN_INTENTS_INVALID");
    optionalJsonField(turn, "resolution_plan_json", ResolutionPlanSchema, "SAVESET_TURN_PLAN_INVALID");
    optionalJsonField(turn, "director_proposal_json", TurnProposalSchema, "SAVESET_TURN_PROPOSAL_INVALID");
    optionalJsonField(turn, "candidate_state_json", WorldStateSchema, "SAVESET_TURN_CANDIDATE_INVALID");
    optionalJsonField(turn, "next_decision_json", DecisionRequestSchema, "SAVESET_TURN_DECISION_INVALID");
    if (turn.resolutions_json !== null) {
      const stored = parseJsonField(turn, "resolutions_json", z.object({
        resolutions: CheckResolutionSchema.array(), nextRngCounter: z.number().int().nonnegative(),
      }).strict(), "SAVESET_TURN_RESOLUTIONS_INVALID");
      void stored;
    }
    for (const key of ["model_profile_json", "narration_json", "error_json"] as const) {
      if (turn[key] !== null) parseJsonField(turn, key, z.unknown(), `SAVESET_TURN_${key.toUpperCase()}_INVALID`);
    }
    if (turn.status === "COMMITTED") {
      const candidate = optionalJsonField(turn, "candidate_state_json", WorldStateSchema,
        "SAVESET_TURN_CANDIDATE_INVALID") as z.infer<typeof WorldStateSchema> | null;
      const nextDecision = optionalJsonField(turn, "next_decision_json", DecisionRequestSchema,
        "SAVESET_TURN_DECISION_INVALID") as z.infer<typeof DecisionRequestSchema> | null;
      if (turn.committed_state_version !== turn.expected_state_version + 1 || candidate === null || nextDecision === null
        || candidate.metadata.campaignId !== manifest.campaignId
        || candidate.metadata.stateVersion !== turn.committed_state_version
        || nextDecision.stateVersion !== turn.committed_state_version
        || JSON.stringify(candidate.currentDecision) !== JSON.stringify(nextDecision)) {
        throw new Error("SAVESET_COMMITTED_TURN_INVALID");
      }
      committedCandidates.set(turn.id, { state: candidate, hash: hashStoredState(candidate) });
    } else if (turn.committed_state_version !== null) throw new Error("SAVESET_TURN_COMMIT_VERSION_INVALID");
  }
  for (const branch of branches) {
    if (branch.parent_branch_id === null) {
      if (branch.fork_turn_id !== null) throw new Error("SAVESET_BRANCH_LINEAGE_INVALID");
    } else {
      const fork = ledger.turns.find((turn) => turn.id === branch.fork_turn_id);
      if (!fork || fork.kind !== "REWIND" || fork.status !== "COMMITTED" || fork.branch_id !== branch.parent_branch_id) {
        throw new Error("SAVESET_BRANCH_LINEAGE_INVALID");
      }
    }
  }
  requireUnique(ledger.turnEvents.map((event) => String(event.sequence)), "SAVESET_TURN_EVENT_DUPLICATE");
  for (const event of ledger.turnEvents) if (!turnIds.has(event.turn_id)) throw new Error("SAVESET_TURN_EVENT_ORPHAN");
  const committedTurns = ledger.turns.filter((turn) => turn.status === "COMMITTED")
    .sort((left, right) => left.committed_state_version! - right.committed_state_version!);
  if (committedTurns.length !== manifest.stateVersion) throw new Error("SAVESET_COMMITTED_STATE_CHAIN_INVALID");
  let previousHash: string | null = null;
  for (const [index, turn] of committedTurns.entries()) {
    const version = index + 1;
    const candidate = committedCandidates.get(turn.id)!;
    const events = ledger.turnEvents.filter((event) => event.turn_id === turn.id && event.status === "COMMITTED");
    if (turn.expected_state_version !== index || turn.committed_state_version !== version
      || (previousHash !== null && turn.before_state_hash !== previousHash)) {
      throw new Error("SAVESET_COMMITTED_STATE_CHAIN_INVALID");
    }
    if (events.length !== 1 || events[0]!.payload_hash !== candidate.hash) {
      throw new Error("SAVESET_COMMITTED_TURN_EVENT_INVALID");
    }
    previousHash = candidate.hash;
  }
  if (previousHash !== (manifest.stateVersion === 0 ? null : manifest.stateHash)) {
    throw new Error("SAVESET_COMMITTED_STATE_CHAIN_INVALID");
  }
  if (ledger.activeTurns.length > 1) throw new Error("SAVESET_ACTIVE_TURN_DUPLICATE");
  for (const active of ledger.activeTurns) {
    requireBelongs(active, manifest.campaignId, "SAVESET_ACTIVE_TURN_CAMPAIGN_MISMATCH");
    const turn = ledger.turns.find((candidate) => candidate.id === active.turn_id);
    if (!turn) throw new Error("SAVESET_ACTIVE_TURN_ORPHAN");
    if (["COMMITTED", "FAILED"].includes(turn.status) || active.reserved_state_version !== turn.expected_state_version
      || active.reserved_decision_id !== turn.decision_id) throw new Error("SAVESET_ACTIVE_TURN_INVALID");
  }
  requireUnique(ledger.recoveryCommands.map((row) => row.id), "SAVESET_RECOVERY_DUPLICATE");
  requireUnique(ledger.recoveryCommands.map((row) => `${row.campaign_id}\0${row.client_request_id}`),
    "SAVESET_RECOVERY_REQUEST_DUPLICATE");
  requireUnique(ledger.recoveryCommands.map((row) => `${row.turn_id}\0${row.decision_id}`),
    "SAVESET_RECOVERY_DECISION_DUPLICATE");
  for (const recovery of ledger.recoveryCommands) {
    requireBelongs(recovery, manifest.campaignId, "SAVESET_RECOVERY_CAMPAIGN_MISMATCH");
    if (!turnIds.has(recovery.turn_id)) throw new Error("SAVESET_RECOVERY_ORPHAN");
    if (recovery.result_json !== null) parseJsonField(recovery, "result_json", z.unknown(), "SAVESET_RECOVERY_RESULT_INVALID");
  }
  requireUnique(ledger.journals.map((row) => `${row.campaign_id}\0${row.state_version}\0${row.audience}`),
    "SAVESET_JOURNAL_DUPLICATE");
  for (const journal of ledger.journals) {
    requireBelongs(journal, manifest.campaignId, "SAVESET_JOURNAL_CAMPAIGN_MISMATCH");
    const parsed = parseJsonField(journal, "journal_json", PlayerJournalSchema,
      "SAVESET_JOURNAL_INVALID") as z.infer<typeof PlayerJournalSchema>;
    if (parsed.campaignId !== manifest.campaignId || parsed.stateVersion !== journal.state_version
      || parsed.audience !== journal.audience || journal.state_version > manifest.stateVersion) {
      throw new Error("SAVESET_JOURNAL_IDENTITY_INVALID");
    }
    validateStateHash(parsed, journal.journal_hash, "SAVESET_JOURNAL_HASH_MISMATCH");
  }

  const checkpoints = rowArray(members["private/checkpoints.json"]!, CheckpointRowSchema, "SAVESET_CHECKPOINTS_INVALID");
  requireUnique(checkpoints.map((row) => row.id), "SAVESET_CHECKPOINT_DUPLICATE");
  requireUnique(checkpoints.map((row) => `${row.campaign_id}\0${row.request_id}`), "SAVESET_CHECKPOINT_REQUEST_DUPLICATE");
  requireUnique(checkpoints.map((row) => `${row.campaign_id}\0${row.branch_id}\0${row.label}`),
    "SAVESET_CHECKPOINT_LABEL_DUPLICATE");
  for (const checkpoint of checkpoints) {
    requireBelongs(checkpoint, manifest.campaignId, "SAVESET_CHECKPOINT_CAMPAIGN_MISMATCH");
    if (!branchIds.has(checkpoint.branch_id)) throw new Error("SAVESET_CHECKPOINT_BRANCH_INVALID");
    const checkpointState = parseJsonField(checkpoint, "state_json", WorldStateSchema, "SAVESET_CHECKPOINT_STATE_INVALID") as z.infer<typeof WorldStateSchema>;
    validateStateHash(checkpointState, checkpoint.state_hash, "SAVESET_CHECKPOINT_HASH_MISMATCH");
    if (checkpointState.metadata.campaignId !== manifest.campaignId
      || checkpointState.metadata.stateVersion !== checkpoint.state_version
      || checkpoint.state_version > manifest.stateVersion) throw new Error("SAVESET_CHECKPOINT_IDENTITY_INVALID");
    if (checkpointState.metadata.rngCounter !== checkpoint.rng_counter) throw new Error("SAVESET_CHECKPOINT_RNG_MISMATCH");
  }

  const creationRequests = rowArray(members["private/creation.json"]!, CreationRowSchema, "SAVESET_CREATION_INVALID");
  requireUnique(creationRequests.map((row) => row.request_id), "SAVESET_CREATION_DUPLICATE");
  for (const creation of creationRequests) {
    if (creation.campaign_id !== manifest.campaignId || creation.owner_id !== world.campaign.ownerId
      || creation.status !== "COMMITTED") throw new Error("SAVESET_CREATION_CAMPAIGN_MISMATCH");
    if (creation.error_json !== null) parseJsonField(creation, "error_json", z.unknown(), "SAVESET_CREATION_ERROR_INVALID");
  }

  return {
    manifest,
    snapshot: {
      campaign: { ...world.campaign, rngSeedBase64: rng.seedBase64 },
      branches, turns: ledger.turns, turnEvents: ledger.turnEvents, activeTurns: ledger.activeTurns,
      recoveryCommands: ledger.recoveryCommands, checkpoints, journals: ledger.journals, creationRequests,
    },
  };
}

export function importFullPrivateSaveSet(input: ImportFullPrivateSaveSetInput): ImportFullPrivateSaveSetResult {
  const validated = validateArchive(input.archive, input.expectedSourcePackManifestHash);
  input.destination.assertEmptyForRestore(validated.manifest.campaignId);
  const apply = input.apply ?? false;
  if (apply) input.destination.restoreCampaign(validated.snapshot);
  return {
    campaignId: validated.manifest.campaignId,
    stateVersion: validated.manifest.stateVersion,
    stateHash: validated.manifest.stateHash,
    applied: apply,
    manifest: validated.manifest,
  };
}

export function validateFullPrivateSaveSet(input: ValidateFullPrivateSaveSetInput) {
  const validated = validateArchive(input.archive, input.expectedSourcePackManifestHash);
  return {
    campaignId: validated.manifest.campaignId,
    stateVersion: validated.manifest.stateVersion,
    stateHash: validated.manifest.stateHash,
    manifest: validated.manifest,
  };
}
