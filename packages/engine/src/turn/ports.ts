import { z } from "zod";
import type { ActorIntent, CheckResolution, ResolutionPlan, TurnProposal, WorldState } from "@third-chair/contracts";

export const NarrationSchema = z.object({
  sceneText: z.string().trim().min(1).max(8_000),
  spokenNpcLines: z.array(z.string().trim().max(2_000)),
  mustIncludeResolutionIds: z.array(z.string()),
  mustIncludeEventIds: z.array(z.string()),
  visibleEventIds: z.array(z.string()),
}).strict();
export type Narration = z.infer<typeof NarrationSchema>;
export interface DirectorRuntime {
  lockAndResolveChecks(plan: ResolutionPlan): {
    readonly planId: ResolutionPlan["id"];
    readonly resolutions: readonly CheckResolution[];
    readonly nextRngCounter: number;
    readonly reused: boolean;
  };
}
export interface DirectorInput {
  readonly turnId: string;
  readonly state: WorldState;
  readonly intents: readonly ActorIntent[];
  readonly persistedPlan: ResolutionPlan | null;
  readonly persistedResolutions: readonly CheckResolution[];
  readonly runtime: DirectorRuntime;
}
export interface DirectorRepairIssue { readonly path: string; readonly message: string; }
export interface DirectorRepairInput {
  readonly turnId: string;
  readonly lockedPlanId: string | null;
  readonly resolutions: readonly { readonly id: string; readonly tier: CheckResolution["tier"] }[];
  readonly invalidProposal: unknown;
  readonly issues: readonly DirectorRepairIssue[];
}
export class InvalidDirectorProposalError extends Error {
  constructor(readonly invalidProposal: unknown, readonly issues: readonly DirectorRepairIssue[]) {
    super("DIRECTOR_INVALID_OUTPUT");
  }
}
export interface NarratorInput { readonly visibleState: unknown; readonly resolutions: readonly CheckResolution[]; readonly proposal: TurnProposal; }
export interface DirectorPort {
  propose(input: DirectorInput): Promise<TurnProposal> | TurnProposal;
  repair?(input: DirectorRepairInput, authoritative: DirectorInput): Promise<TurnProposal> | TurnProposal;
}
export interface NarratorPort { narrate(input: NarratorInput): Promise<Narration> | Narration; }
