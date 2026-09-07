import type { ActorIntent, CheckResolution, DecisionRequest, PlayerJournal, ResolutionPlan, TurnProposal, WorldState } from "@third-chair/contracts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type CampaignId = string;
export type BranchId = string;
export type TurnId = string;
export type ClientRequestId = string;
export type CheckpointId = string;

export type CheckpointReason =
  | "CAMPAIGN_START"
  | "NAMED"
  | "DEATH_RISK"
  | "IRREVERSIBLE_ALLEGIANCE"
  | "PERMANENT_RARE_RESOURCE"
  | "MAJOR_BRANCH_CLOSURE"
  | "LEVEL_ADVANCEMENT";

export interface CheckpointRecord {
  readonly id: CheckpointId;
  readonly campaignId: CampaignId;
  readonly branchId: BranchId;
  readonly requestId: string;
  readonly stateVersion: number;
  readonly label: string;
  readonly reason: CheckpointReason;
  readonly state: WorldState;
  readonly stateHash: string;
  readonly rngCounter: number;
  readonly createdAt: string;
}

export interface CreateCheckpointSnapshotInput {
  readonly checkpointId: CheckpointId;
  readonly campaignId: CampaignId;
  readonly branchId: BranchId;
  readonly requestId: string;
  readonly stateVersion: number;
  readonly label: string;
  readonly reason: CheckpointReason;
  readonly state: WorldState;
  readonly stateHash: string;
  readonly rngCounter: number;
  readonly createdAt: string;
}

export interface CreateNamedCheckpointInput {
  readonly checkpointId: CheckpointId;
  readonly campaignId: CampaignId;
  readonly requestId: string;
  readonly expectedStateVersion: number;
  readonly label: string;
  readonly createdAt?: string;
}

export interface CheckpointRepository {
  createNamed(input: CreateNamedCheckpointInput): CheckpointRecord;
  get(checkpointId: CheckpointId): CheckpointRecord;
  list(campaignId: CampaignId): readonly CheckpointRecord[];
  rewind(input: RewindCheckpointCommitInput): RewindCheckpointRecord;
}

export interface RewindCheckpointCommitInput {
  readonly campaignId: CampaignId;
  readonly checkpointId: CheckpointId;
  readonly requestId: ClientRequestId;
  readonly inputHash: string;
  readonly expectedStateVersion: number;
  readonly rewindTurnId: TurnId;
  readonly newBranchId: BranchId;
  readonly restoredState: WorldState;
  readonly restoredStateHash: string;
  readonly nextDecision: DecisionRequest;
  readonly createdAt?: string;
}

export interface RewindCheckpointRecord {
  readonly checkpoint: CheckpointRecord;
  readonly rewindTurnId: TurnId;
  readonly abandonedBranchId: BranchId;
  readonly activeBranchId: BranchId;
  readonly stateVersion: number;
  readonly currentState: WorldState;
  readonly currentStateHash: string;
  readonly currentDecision: DecisionRequest;
}

export type CampaignCreationStatus = "PROCESSING" | "COMMITTED" | "FAILED";
export interface CampaignCreationRequestRecord {
  readonly requestId: string;
  readonly ownerId: string;
  readonly inputHash: string;
  readonly status: CampaignCreationStatus;
  readonly campaignId: string | null;
  readonly error: JsonValue | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export type BeginCampaignCreationResult = {
  readonly kind: "STARTED" | "EXISTING";
  readonly request: CampaignCreationRequestRecord;
};

export type CampaignStatus = "ACTIVE" | "READ_ONLY" | "ARCHIVED";
export type TurnStatus =
  | "PROCESSING"
  | "PLANNED"
  | "RESOLVED"
  | "AWAITING_INPUT"
  | "COMMITTED"
  | "FAILED";
export type TurnKind = "GAME" | "REWIND";

export interface CreateCampaignInput {
  readonly id: CampaignId;
  readonly ownerId: string;
  readonly name: string;
  readonly sourcePackHash: string;
  readonly rngSeed: Uint8Array;
  readonly currentState: WorldState;
  readonly currentStateHash: string;
  readonly rootBranchId: BranchId;
  readonly rootBranchLabel: string;
  readonly status?: CampaignStatus;
  readonly createdAt?: string;
}

export interface CampaignRecord {
  readonly id: CampaignId;
  readonly ownerId: string;
  readonly name: string;
  readonly sourcePackHash: string;
  readonly rngSeed: Uint8Array;
  readonly stateVersion: number;
  readonly currentState: WorldState;
  readonly currentStateHash: string;
  readonly currentDecision: DecisionRequest;
  readonly activeBranchId: BranchId;
  readonly status: CampaignStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BeginTurnInput {
  readonly turnId: TurnId;
  readonly campaignId: CampaignId;
  readonly branchId: BranchId;
  readonly clientRequestId: ClientRequestId;
  readonly expectedStateVersion: number;
  readonly decisionId: string;
  readonly inputHash: string;
  readonly lockedIntents: readonly ActorIntent[];
  readonly modelProfile?: JsonValue;
  readonly createdAt?: string;
}

export interface TurnFailure {
  readonly code: string;
  readonly message: string;
  readonly details?: JsonValue;
}

export interface TurnRecord {
  readonly id: TurnId;
  readonly kind: TurnKind;
  readonly campaignId: CampaignId;
  readonly branchId: BranchId;
  readonly clientRequestId: ClientRequestId;
  readonly expectedStateVersion: number;
  readonly decisionId: string;
  readonly inputHash: string;
  readonly status: TurnStatus;
  readonly beforeState: WorldState;
  readonly beforeStateHash: string;
  readonly lockedIntents: readonly ActorIntent[];
  readonly modelProfile: JsonValue | null;
  readonly resolutionPlan: ResolutionPlan | null;
  readonly resolutions: readonly CheckResolution[] | null;
  readonly nextRngCounter: number | null;
  readonly directorProposal: TurnProposal | null;
  readonly candidateState: WorldState | null;
  readonly narration: JsonValue | null;
  readonly nextDecision: DecisionRequest | null;
  readonly failure: TurnFailure | null;
  readonly committedStateVersion: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type BeginTurnResult =
  | { readonly kind: "STARTED"; readonly turn: TurnRecord }
  | { readonly kind: "EXISTING"; readonly turn: TurnRecord }
  | { readonly kind: "ACTIVE_SUCCESSOR"; readonly turn: TurnRecord };

export interface BeginRecoveryInput {
  readonly id: string;
  readonly campaignId: CampaignId;
  readonly turnId: TurnId;
  readonly clientRequestId: ClientRequestId;
  readonly decisionId: string;
  readonly expectedStateVersion: number;
  readonly inputHash: string;
}
export interface RecoveryCommandRecord extends BeginRecoveryInput {
  readonly status: "PROCESSING" | "COMMITTED" | "FAILED";
  readonly result: JsonValue | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export type BeginRecoveryResult = { readonly kind: "STARTED" | "EXISTING"; readonly command: RecoveryCommandRecord };

export interface CommitTurnInput {
  readonly turnId: TurnId;
  readonly candidateStateHash: string;
  readonly narration: JsonValue;
  readonly nextDecision: DecisionRequest;
  readonly journals?: readonly PlayerJournal[];
  readonly automaticCheckpoint?: {
    readonly checkpointId: CheckpointId;
    readonly requestId: string;
    readonly label: string;
    readonly reason: Exclude<CheckpointReason, "CAMPAIGN_START" | "NAMED">;
  };
  readonly committedAt?: string;
}

export interface JournalRecord {
  readonly campaignId: CampaignId;
  readonly stateVersion: number;
  readonly audience: PlayerJournal["audience"];
  readonly journal: PlayerJournal;
  readonly journalHash: string;
  readonly createdAt: string;
}

export interface JournalRepository {
  get(campaignId: CampaignId, stateVersion: number, audience: PlayerJournal["audience"]): JournalRecord;
  listAtVersion(campaignId: CampaignId, stateVersion: number): readonly JournalRecord[];
}

export type CommittedTurn = TurnRecord & {
  readonly status: "COMMITTED";
  readonly committedStateVersion: number;
};

export interface CampaignRepository {
  createCampaign(input: CreateCampaignInput): CampaignRecord;
  getCampaign(campaignId: CampaignId): CampaignRecord;
  listCampaigns(): readonly CampaignRecord[];
}

export interface CampaignCreationRepository {
  begin(input: { requestId: string; ownerId: string; inputHash: string; createdAt?: string }): BeginCampaignCreationResult;
  commit(requestId: string, inputHash: string, campaign: CreateCampaignInput): CampaignRecord;
  fail(requestId: string, inputHash: string, error: TurnFailure, failedAt?: string): CampaignCreationRequestRecord;
  get(requestId: string): CampaignCreationRequestRecord;
}

export interface TurnRepository {
  beginTurn(input: BeginTurnInput): BeginTurnResult;
  beginRecovery(input: BeginRecoveryInput): BeginRecoveryResult;
  completeRecovery(id: string, status: "COMMITTED" | "FAILED", result: JsonValue): RecoveryCommandRecord;
  getRecovery(id: string): RecoveryCommandRecord;
  persistPlan(turnId: TurnId, plan: ResolutionPlan): void;
  persistResolutions(turnId: TurnId, resolutions: readonly CheckResolution[], rngCounter: number): void;
  persistNoCheckResolution(turnId: TurnId, rngCounter: number): void;
  persistProposal(turnId: TurnId, proposal: TurnProposal, candidate: WorldState): void;
  commitTurn(input: CommitTurnInput): CommittedTurn;
  markAwaitingInput(turnId: TurnId, decision: DecisionRequest): void;
  markFailed(turnId: TurnId, failure: TurnFailure): void;
  abandonTurn(turnId: TurnId, failure: TurnFailure): void;
  getTurn(turnId: TurnId): TurnRecord;
  findByRequest(campaignId: CampaignId, clientRequestId: ClientRequestId): TurnRecord | null;
  listRecentCommitted(campaignId: CampaignId, limit: number): readonly CommittedTurn[];
}

export type ArchiveScalar = string | number | null;
export type ArchiveRow = Readonly<Record<string, ArchiveScalar>>;

export interface ArchiveCampaignRow {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly sourcePackHash: string;
  readonly rngSeedBase64: string;
  readonly stateVersion: number;
  readonly currentStateJson: string;
  readonly currentStateHash: string;
  readonly currentDecisionJson: string;
  readonly activeBranchId: string;
  readonly status: CampaignStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignArchiveSnapshot {
  readonly campaign: ArchiveCampaignRow;
  readonly branches: readonly ArchiveRow[];
  readonly turns: readonly ArchiveRow[];
  readonly turnEvents: readonly ArchiveRow[];
  readonly activeTurns: readonly ArchiveRow[];
  readonly recoveryCommands: readonly ArchiveRow[];
  readonly checkpoints: readonly ArchiveRow[];
  readonly journals: readonly ArchiveRow[];
  readonly creationRequests: readonly ArchiveRow[];
}

export interface CampaignArchiveRepository {
  readCampaign(campaignId: CampaignId): CampaignArchiveSnapshot;
  assertEmptyForRestore(campaignId: CampaignId): void;
  restoreCampaign(snapshot: CampaignArchiveSnapshot): void;
}

export interface ExportRecord {
  readonly id: string;
  readonly campaignId: string;
  readonly ownerId: string;
  readonly stateVersion: number;
  readonly mode: "PLAYER_SAFE" | "FULL_PRIVATE";
  readonly requestId: string;
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly expiresAt: string;
}

export interface CreateExportRecordInput extends Omit<ExportRecord, "ownerId"> {}

export interface ExportRepository {
  get(exportId: string): ExportRecord;
  findByRequest(campaignId: string, requestId: string): ExportRecord | null;
  create(input: CreateExportRecordInput): ExportRecord;
}
