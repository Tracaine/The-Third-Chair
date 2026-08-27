import { z } from "zod";
import type { ActorIntent, CheckResolution, ResolutionPlan, TurnProposal, WorldState } from "@third-chair/contracts";
export declare const NarrationSchema: z.ZodObject<{
    sceneText: z.ZodString;
    spokenNpcLines: z.ZodArray<z.ZodString>;
    mustIncludeResolutionIds: z.ZodArray<z.ZodString>;
    mustIncludeEventIds: z.ZodArray<z.ZodString>;
    visibleEventIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type Narration = z.infer<typeof NarrationSchema>;
export interface DirectorRuntime {
    lockAndResolveChecks(plan: ResolutionPlan): {
        readonly resolutions: readonly CheckResolution[];
        readonly nextRngCounter: number;
    };
}
export interface DirectorInput {
    readonly state: WorldState;
    readonly intents: readonly ActorIntent[];
    readonly runtime: DirectorRuntime;
}
export interface NarratorInput {
    readonly visibleState: unknown;
    readonly resolutions: readonly CheckResolution[];
    readonly proposal: TurnProposal;
}
export interface DirectorPort {
    propose(input: DirectorInput): Promise<TurnProposal> | TurnProposal;
}
export interface NarratorPort {
    narrate(input: NarratorInput): Promise<Narration> | Narration;
}
//# sourceMappingURL=ports.d.ts.map