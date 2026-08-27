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
export interface DirectorRuntime { lockAndResolveChecks(plan: ResolutionPlan): { readonly resolutions: readonly CheckResolution[]; readonly nextRngCounter: number }; }
export interface DirectorInput { readonly state: WorldState; readonly intents: readonly ActorIntent[]; readonly runtime: DirectorRuntime; }
export interface NarratorInput { readonly visibleState: unknown; readonly resolutions: readonly CheckResolution[]; readonly proposal: TurnProposal; }
export interface DirectorPort { propose(input: DirectorInput): Promise<TurnProposal> | TurnProposal; }
export interface NarratorPort { narrate(input: NarratorInput): Promise<Narration> | Narration; }
