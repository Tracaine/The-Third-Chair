import type { ActorIntent, CheckResolution, DecisionRequest, ResolutionPlan, TurnProposal, WorldState } from "@third-chair/contracts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type CampaignId = string;
export type BranchId = string;
export type TurnId = string;
export type ClientRequestId = string;

export type CampaignStatus = "ACTIVE" | "READ_ONLY" | "ARCHIVED";
export type TurnStatus =
  | "PROCESSING"
  | "PLANNED"
  | "RESOLVED"
  | "AWAITING_INPUT"
  | "COMMITTED"
  | "FAILED";

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
  readonly committedAt?: string;
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
}
