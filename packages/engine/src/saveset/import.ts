import {
  ActorIntentSchema,
  CheckResolutionSchema,
  DecisionRequestSchema,
  PlayerActorViewSchema,
  PlayerJournalSchema,
  ResolutionPlanSchema,
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
const CampaignStatusSchema = z.enum(["ACTIVE", "READ_ONLY", "ARCHIVED"]);
const WorldPayloadSchema = z.object({
  campaign: z.object({
    id: z.string(), ownerId: z.string(), name: z.string(), sourcePackHash: z.string(),
    stateVersion: z.number().int().nonnegative(), currentStateJson: z.string(), currentStateHash: z.string(),
    currentDecisionJson: z.string(), activeBranchId: z.string(), status: CampaignStatusSchema,
    createdAt: z.string(), updatedAt: z.string(),
  }).strict(),
}).strict();
const RngPayloadSchema = z.object({ seedBase64: z.string(), counter: z.number().int().nonnegative() }).strict();
const LedgerRecordSchema = z.object({
  recordType: z.enum(["TURN", "TURN_EVENT", "ACTIVE_TURN", "RECOVERY_COMMAND", "JOURNAL"]),
  data: ArchiveRowSchema,
}).strict();

const keys = {
  branch: ["id", "campaign_id", "parent_branch_id", "fork_turn_id", "label", "status", "created_at"],
  turn: ["id", "campaign_id", "branch_id", "client_request_id", "expected_state_version", "decision_id", "input_hash",
    "status", "before_state_json", "before_state_hash", "locked_intents_json", "model_profile_json", "resolution_plan_json",
    "resolutions_json", "director_proposal_json", "candidate_state_json", "narration_json", "next_decision_json", "error_json",
    "committed_state_version", "created_at", "updated_at", "kind"],
  turnEvent: ["sequence", "turn_id", "status", "payload_hash", "created_at"],
  activeTurn: ["campaign_id", "turn_id", "reserved_state_version", "reserved_decision_id", "reserved_at"],
  recovery: ["id", "campaign_id", "turn_id", "client_request_id", "decision_id", "expected_state_version", "input_hash",
    "status", "result_json", "created_at", "updated_at"],
  checkpoint: ["id", "campaign_id", "branch_id", "request_id", "state_version", "label", "reason", "state_json",
    "state_hash", "rng_counter", "created_at"],
  journal: ["campaign_id", "state_version", "audience", "journal_json", "journal_hash", "created_at"],
  creation: ["request_id", "owner_id", "input_hash", "status", "campaign_id", "error_json", "created_at", "updated_at"],
} as const;

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

function exactRow(raw: unknown, expectedKeys: readonly string[], code: string): ArchiveRow {
  const row = ArchiveRowSchema.parse(raw);
  const actual = Object.keys(row).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(code);
  return row;
}

function rowArray(bytes: Uint8Array, expectedKeys: readonly string[], code: string): ArchiveRow[] {
  return z.array(z.unknown()).parse(json(bytes, code)).map((row) => exactRow(row, expectedKeys, code));
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

function parseLedger(bytes: Uint8Array) {
  const text = decoder.decode(bytes);
  const records = text.length === 0 ? [] : text.trimEnd().split("\n").map((line) => {
    try { return LedgerRecordSchema.parse(JSON.parse(line)); }
    catch { throw new Error("SAVESET_TURN_LEDGER_INVALID"); }
  });
  return {
    turns: records.filter((record) => record.recordType === "TURN").map(({ data }) => exactRow(data, keys.turn, "SAVESET_TURN_INVALID")),
    turnEvents: records.filter((record) => record.recordType === "TURN_EVENT").map(({ data }) => exactRow(data, keys.turnEvent, "SAVESET_TURN_EVENT_INVALID")),
    activeTurns: records.filter((record) => record.recordType === "ACTIVE_TURN").map(({ data }) => exactRow(data, keys.activeTurn, "SAVESET_ACTIVE_TURN_INVALID")),
    recoveryCommands: records.filter((record) => record.recordType === "RECOVERY_COMMAND").map(({ data }) => exactRow(data, keys.recovery, "SAVESET_RECOVERY_INVALID")),
    journals: records.filter((record) => record.recordType === "JOURNAL").map(({ data }) => exactRow(data, keys.journal, "SAVESET_JOURNAL_INVALID")),
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

  const branches = rowArray(members["branches.json"]!, keys.branch, "SAVESET_BRANCHES_INVALID");
  const branchIds = new Set<string>();
  for (const branch of branches) {
    requireBelongs(branch, manifest.campaignId, "SAVESET_BRANCH_CAMPAIGN_MISMATCH");
    if (typeof branch.id !== "string" || branchIds.has(branch.id)) throw new Error("SAVESET_BRANCH_DUPLICATE");
    branchIds.add(branch.id);
  }
  for (const branch of branches) {
    if (branch.parent_branch_id !== null && (typeof branch.parent_branch_id !== "string" || !branchIds.has(branch.parent_branch_id))) {
      throw new Error("SAVESET_BRANCH_LINEAGE_INVALID");
    }
  }
  if (!branchIds.has(manifest.activeBranchId)) throw new Error("SAVESET_ACTIVE_BRANCH_MISSING");

  const ledger = parseLedger(members["private/turns.jsonl"]!);
  const turnIds = new Set<string>();
  for (const turn of ledger.turns) {
    requireBelongs(turn, manifest.campaignId, "SAVESET_TURN_CAMPAIGN_MISMATCH");
    if (typeof turn.id !== "string" || turnIds.has(turn.id) || typeof turn.branch_id !== "string" || !branchIds.has(turn.branch_id)) {
      throw new Error("SAVESET_TURN_IDENTITY_INVALID");
    }
    turnIds.add(turn.id);
    const before = parseJsonField(turn, "before_state_json", WorldStateSchema, "SAVESET_TURN_BEFORE_STATE_INVALID");
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
  }
  for (const event of ledger.turnEvents) if (typeof event.turn_id !== "string" || !turnIds.has(event.turn_id)) throw new Error("SAVESET_TURN_EVENT_ORPHAN");
  for (const active of ledger.activeTurns) {
    requireBelongs(active, manifest.campaignId, "SAVESET_ACTIVE_TURN_CAMPAIGN_MISMATCH");
    if (typeof active.turn_id !== "string" || !turnIds.has(active.turn_id)) throw new Error("SAVESET_ACTIVE_TURN_ORPHAN");
  }
  for (const recovery of ledger.recoveryCommands) {
    requireBelongs(recovery, manifest.campaignId, "SAVESET_RECOVERY_CAMPAIGN_MISMATCH");
    if (typeof recovery.turn_id !== "string" || !turnIds.has(recovery.turn_id)) throw new Error("SAVESET_RECOVERY_ORPHAN");
    if (recovery.result_json !== null) parseJsonField(recovery, "result_json", z.unknown(), "SAVESET_RECOVERY_RESULT_INVALID");
  }
  for (const journal of ledger.journals) {
    requireBelongs(journal, manifest.campaignId, "SAVESET_JOURNAL_CAMPAIGN_MISMATCH");
    const parsed = parseJsonField(journal, "journal_json", PlayerJournalSchema, "SAVESET_JOURNAL_INVALID");
    validateStateHash(parsed, journal.journal_hash, "SAVESET_JOURNAL_HASH_MISMATCH");
  }

  const checkpoints = rowArray(members["private/checkpoints.json"]!, keys.checkpoint, "SAVESET_CHECKPOINTS_INVALID");
  for (const checkpoint of checkpoints) {
    requireBelongs(checkpoint, manifest.campaignId, "SAVESET_CHECKPOINT_CAMPAIGN_MISMATCH");
    if (typeof checkpoint.branch_id !== "string" || !branchIds.has(checkpoint.branch_id)) throw new Error("SAVESET_CHECKPOINT_BRANCH_INVALID");
    const checkpointState = parseJsonField(checkpoint, "state_json", WorldStateSchema, "SAVESET_CHECKPOINT_STATE_INVALID") as z.infer<typeof WorldStateSchema>;
    validateStateHash(checkpointState, checkpoint.state_hash, "SAVESET_CHECKPOINT_HASH_MISMATCH");
    if (checkpointState.metadata.rngCounter !== checkpoint.rng_counter) throw new Error("SAVESET_CHECKPOINT_RNG_MISMATCH");
  }

  const creationRequests = rowArray(members["private/creation.json"]!, keys.creation, "SAVESET_CREATION_INVALID");
  for (const creation of creationRequests) {
    requireBelongs(creation, manifest.campaignId, "SAVESET_CREATION_CAMPAIGN_MISMATCH");
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
