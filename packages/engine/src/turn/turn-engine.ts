import {
  AdvanceGameCommandSchema, CheckResolutionSchema, ResolutionPlanSchema, TurnProposalSchema,
  type AdvanceGameCommand, type CheckResolution, type ResolutionPlan, type TurnProposal,
} from "@third-chair/contracts";
import type { CampaignRepository, TurnRecord, TurnRepository } from "@third-chair/storage";
import { sha256Json } from "../hash.js";
import { applyOperationsToClone } from "../operations/apply.js";
import { projectPlayerView } from "../projection/player-view.js";
import { resolvePlan } from "../resolution/dice.js";
import { KeyedMutex } from "../mutex.js";
import { deriveDecisionAuthority } from "./decision-policy.js";
import { finalizeCandidateForCommit } from "./finalize-candidate.js";
import { NarrationSchema, type DirectorPort, type NarratorPort } from "./ports.js";

export interface AdvanceGameResult { readonly kind: "COMMITTED" | "ACTIVE_SUCCESSOR"; readonly turn: TurnRecord; readonly view: ReturnType<typeof projectPlayerView>; readonly visibleRolls: readonly CheckResolution[]; readonly narration: unknown; }
export interface TurnEngineDeps { readonly campaigns: CampaignRepository; readonly turns: TurnRepository; readonly director: DirectorPort; readonly narrator: NarratorPort; readonly newTurnId?: () => string; readonly failureInjector?: { check(stage: string): void }; }
function nextId(): string { return `test_turn_${crypto.randomUUID().replaceAll("-", "_")}`; }
function parseResolutions(turn: TurnRecord): readonly CheckResolution[] { return (turn.resolutions ?? []).map((value) => CheckResolutionSchema.parse(value)); }
export interface TurnEngine { advanceGame(command: AdvanceGameCommand): Promise<AdvanceGameResult>; }
export function createTurnEngine(deps: TurnEngineDeps): TurnEngine {
  const mutex = new KeyedMutex();
  return { async advanceGame(raw): Promise<AdvanceGameResult> {
    const command = AdvanceGameCommandSchema.parse(raw);
    return mutex.run(command.campaignId, async () => {
      const campaign = deps.campaigns.getCampaign(command.campaignId);
      const started = deps.turns.beginTurn({ turnId: (deps.newTurnId ?? nextId)(), campaignId: command.campaignId, branchId: campaign.activeBranchId, clientRequestId: command.clientRequestId, expectedStateVersion: command.expectedStateVersion, decisionId: command.decisionId, inputHash: sha256Json(command), lockedIntents: command.intents });
      if (started.kind === "ACTIVE_SUCCESSOR") {
        return { kind: "ACTIVE_SUCCESSOR", turn: started.turn, view: projectPlayerView(campaign.currentState, "RAVEN"), visibleRolls: [], narration: null };
      }
      let turn = started.turn;
      if (turn.status === "COMMITTED") {
        const committed = deps.campaigns.getCampaign(command.campaignId);
        return { kind: "COMMITTED", turn, view: projectPlayerView(committed.currentState, "RAVEN"), visibleRolls: parseResolutions(turn).filter((roll) => roll.visibility === "PUBLIC"), narration: turn.narration };
      }
      let resolved: readonly CheckResolution[] = parseResolutions(turn);
      let nextRngCounter = turn.nextRngCounter;
      const lockAndResolveChecks = (rawPlan: ResolutionPlan) => {
        const plan = ResolutionPlanSchema.parse(rawPlan);
        if (turn.resolutionPlan !== null) {
          const stored = ResolutionPlanSchema.parse(turn.resolutionPlan);
          if (sha256Json(stored) !== sha256Json(plan)) throw new Error("RESOLUTION_PLAN_ALREADY_LOCKED");
          if (turn.resolutions === null || turn.nextRngCounter === null) throw new Error("LOCKED_PLAN_UNRESOLVED");
          resolved = parseResolutions(turn); nextRngCounter = turn.nextRngCounter;
          return { resolutions: resolved, nextRngCounter };
        }
        deps.turns.persistPlan(turn.id, plan);
        deps.failureInjector?.check("PLANNED");
        const result = resolvePlan(campaign.rngSeed, campaign.id, turn.beforeState.metadata.rngCounter, plan);
        deps.turns.persistResolutions(turn.id, result.resolutions, result.nextRngCounter);
        deps.failureInjector?.check("RESOLVED");
        turn = deps.turns.getTurn(turn.id); resolved = result.resolutions; nextRngCounter = result.nextRngCounter;
        return result;
      };
      deps.failureInjector?.check("PROCESSING");
      const proposal = TurnProposalSchema.parse(await deps.director.propose({ state: turn.beforeState, intents: turn.lockedIntents, runtime: { lockAndResolveChecks } }));
      if (nextRngCounter === null) throw new Error("DIRECTOR_DID_NOT_RESOLVE_CHECKS");
      const nextDecision = deriveDecisionAuthority(turn.beforeState, proposal.nextDecision);
      const applied = applyOperationsToClone(turn.beforeState, [...proposal.uncontestedOperations, ...proposal.checkLinkedOperations], { intents: turn.lockedIntents, resolutions: resolved });
      deps.failureInjector?.check("CANDIDATE_VALIDATION");
      const finalized = finalizeCandidateForCommit({ previous: turn.beforeState, candidate: applied.candidate, proposedNextDecision: nextDecision, nextRngCounter });
      deps.turns.persistProposal(turn.id, proposal, finalized.candidate);
      const afterView = projectPlayerView(finalized.candidate, "RAVEN");
      const narration = NarrationSchema.parse(await deps.narrator.narrate({ visibleState: afterView, resolutions: resolved.filter((roll) => roll.visibility === "PUBLIC"), proposal }));
      const expectedResolutions = proposal.narrativeBrief.requiredResolutionIds;
      if (expectedResolutions.some((id) => !narration.mustIncludeResolutionIds.includes(id))) throw new Error("NARRATION_MISSING_RESOLUTION");
      deps.failureInjector?.check("NARRATION");
      const committed = deps.turns.commitTurn({ turnId: turn.id, candidateStateHash: sha256Json(finalized.candidate), narration, nextDecision: finalized.nextDecision });
      const committedCampaign = deps.campaigns.getCampaign(command.campaignId);
      return { kind: "COMMITTED", turn: committed, view: projectPlayerView(committedCampaign.currentState, "RAVEN"), visibleRolls: resolved.filter((roll) => roll.visibility === "PUBLIC"), narration };
    });
  }};
}
