import {
  AdvanceGameCommandSchema, CheckResolutionSchema, ResolutionPlanSchema, TurnProposalSchema,
  type AdvanceGameCommand, type CheckResolution, type ResolutionPlan, type TurnProposal,
} from "@third-chair/contracts";
import type { CampaignRepository, JsonValue, TurnRecord, TurnRepository } from "@third-chair/storage";
import { sha256Json } from "../hash.js";
import { applyOperationsToClone } from "../operations/apply.js";
import { projectPlayerView } from "../projection/player-view.js";
import { resolvePlan } from "../resolution/dice.js";
import { KeyedMutex } from "../mutex.js";
import { deriveDecisionAuthority } from "./decision-policy.js";
import { finalizeCandidateForCommit } from "./finalize-candidate.js";
import { InvalidDirectorProposalError, NarrationSchema, type DirectorPort, type DirectorRepairIssue, type NarratorPort } from "./ports.js";

export interface AdvanceGameResult { readonly kind: "COMMITTED" | "ACTIVE_SUCCESSOR"; readonly turn: TurnRecord; readonly view: ReturnType<typeof projectPlayerView>; readonly visibleRolls: readonly CheckResolution[]; readonly narration: unknown; }
export interface TurnEngineDeps { readonly campaigns: CampaignRepository; readonly turns: TurnRepository; readonly director: DirectorPort; readonly narrator: NarratorPort; readonly newTurnId?: () => string; readonly failureInjector?: { check(stage: string): void }; }
function nextId(): string { return `test_turn_${crypto.randomUUID().replaceAll("-", "_")}`; }
function parseResolutions(turn: TurnRecord): readonly CheckResolution[] { return (turn.resolutions ?? []).map((value) => CheckResolutionSchema.parse(value)); }
function safeIssue(error: unknown): DirectorRepairIssue {
  const message = error instanceof Error && /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message)
    ? error.message : "DIRECTOR_PROPOSAL_INVALID";
  return { path: "/", message };
}
function safeRepairValue(value: unknown): unknown {
  try { return JSON.parse(JSON.stringify(value ?? null)) as unknown; }
  catch { return null; }
}
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
        turn = deps.turns.getTurn(turn.id);
        if (turn.resolutionPlan !== null) {
          const stored = ResolutionPlanSchema.parse(turn.resolutionPlan);
          if (sha256Json(stored) !== sha256Json(plan)) throw new Error("LOCKED_PLAN_MISMATCH");
          if (turn.resolutions !== null && turn.nextRngCounter !== null) {
            resolved = parseResolutions(turn); nextRngCounter = turn.nextRngCounter;
            return { planId: stored.id, resolutions: resolved, nextRngCounter, reused: true };
          }
          const result = resolvePlan(campaign.rngSeed, campaign.id, turn.beforeState.metadata.rngCounter, stored);
          deps.turns.persistResolutions(turn.id, result.resolutions, result.nextRngCounter);
          deps.failureInjector?.check("RESOLVED");
          turn = deps.turns.getTurn(turn.id); resolved = result.resolutions; nextRngCounter = result.nextRngCounter;
          return { planId: stored.id, ...result, reused: false };
        }
        deps.turns.persistPlan(turn.id, plan);
        deps.failureInjector?.check("PLANNED");
        const result = resolvePlan(campaign.rngSeed, campaign.id, turn.beforeState.metadata.rngCounter, plan);
        deps.turns.persistResolutions(turn.id, result.resolutions, result.nextRngCounter);
        deps.failureInjector?.check("RESOLVED");
        turn = deps.turns.getTurn(turn.id); resolved = result.resolutions; nextRngCounter = result.nextRngCounter;
        return { planId: plan.id, ...result, reused: false };
      };
      deps.failureInjector?.check("PROCESSING");
      const directorInput = { turnId: turn.id, state: turn.beforeState, intents: turn.lockedIntents,
        persistedPlan: turn.resolutionPlan === null ? null : ResolutionPlanSchema.parse(turn.resolutionPlan),
        persistedResolutions: resolved, runtime: { lockAndResolveChecks } };

      const evaluate = (rawProposal: unknown) => {
        const parsed = TurnProposalSchema.safeParse(rawProposal);
        if (!parsed.success) {
          throw new InvalidDirectorProposalError(rawProposal,
            parsed.error.issues.slice(0, 20).map((issue) => ({
              path: `/${issue.path.map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`,
              message: "INVALID_VALUE",
            })));
        }
        const proposal = parsed.data;
        const noCheck = nextRngCounter === null;
        if (noCheck && (turn.resolutionPlan !== null || proposal.checkLinkedOperations.length > 0
          || proposal.narrativeBrief.requiredResolutionIds.length > 0)) {
          throw new Error("DIRECTOR_DID_NOT_RESOLVE_CHECKS");
        }
        const counter = nextRngCounter ?? turn.beforeState.metadata.rngCounter;
        const nextDecision = deriveDecisionAuthority(turn.beforeState, proposal.nextDecision);
        const applied = applyOperationsToClone(turn.beforeState,
          [...proposal.uncontestedOperations, ...proposal.checkLinkedOperations],
          { intents: turn.lockedIntents, resolutions: resolved });
        const finalized = finalizeCandidateForCommit({ previous: turn.beforeState, candidate: applied.candidate,
          proposedNextDecision: nextDecision, nextRngCounter: counter });
        return { proposal, finalized, noCheck };
      };

      let rawProposal: unknown;
      let rejected: InvalidDirectorProposalError | null = null;
      try { rawProposal = await deps.director.propose(directorInput); }
      catch (error) {
        if (!(error instanceof InvalidDirectorProposalError)) throw error;
        rawProposal = error.invalidProposal;
        rejected = error;
      }
      let evaluated: ReturnType<typeof evaluate> | null = null;
      if (rejected === null) {
        try { evaluated = evaluate(rawProposal); }
        catch (error) {
          rejected = error instanceof InvalidDirectorProposalError
            ? error : new InvalidDirectorProposalError(rawProposal, [safeIssue(error)]);
        }
      }

      if (rejected !== null) {
        turn = deps.turns.getTurn(turn.id);
        resolved = parseResolutions(turn);
        nextRngCounter = turn.nextRngCounter;
        const issues = rejected.issues.slice(0, 20).map((issue) => ({
          path: issue.path.startsWith("/") ? issue.path.slice(0, 500) : "/",
          message: /^[A-Z][A-Z0-9_]{2,100}$/.test(issue.message) ? issue.message : "DIRECTOR_PROPOSAL_INVALID",
        }));
        const authoritative = { ...directorInput,
          persistedPlan: turn.resolutionPlan === null ? null : ResolutionPlanSchema.parse(turn.resolutionPlan),
          persistedResolutions: resolved };
        try {
          if (!deps.director.repair) throw new Error("DIRECTOR_REPAIR_UNAVAILABLE");
          const repaired = await deps.director.repair({
            turnId: turn.id, lockedPlanId: authoritative.persistedPlan?.id ?? null,
            resolutions: resolved.map(({ id, tier }) => ({ id, tier })),
            invalidProposal: safeRepairValue(rejected.invalidProposal), issues,
          }, authoritative);
          evaluated = evaluate(repaired);
        } catch (error) {
          const finalIssues = error instanceof InvalidDirectorProposalError
            ? error.issues.slice(0, 20).map((issue) => ({ path: issue.path.startsWith("/") ? issue.path : "/",
              message: /^[A-Z][A-Z0-9_]{2,100}$/.test(issue.message) ? issue.message : "DIRECTOR_PROPOSAL_INVALID" }))
            : [safeIssue(error)];
          deps.turns.markFailed(turn.id, { code: "DIRECTOR_REPAIR_FAILED",
            message: "Director proposal failed validation after one repair.",
            details: { stage: "CANDIDATE_VALIDATION", turnId: turn.id, modelProfile: turn.modelProfile,
              issues: finalIssues.map(({ path, message }) => ({ path, message })) as JsonValue } });
          throw new Error("DIRECTOR_REPAIR_FAILED");
        }
      }

      if (evaluated === null) throw new Error("DIRECTOR_PROPOSAL_INVALID");
      deps.failureInjector?.check("CANDIDATE_VALIDATION");
      const { proposal, finalized } = evaluated;
      if (evaluated.noCheck) {
        deps.turns.persistNoCheckResolution(turn.id, turn.beforeState.metadata.rngCounter);
        turn = deps.turns.getTurn(turn.id);
        resolved = parseResolutions(turn);
        nextRngCounter = turn.nextRngCounter;
      }
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
