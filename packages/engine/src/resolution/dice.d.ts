import { type CheckResolution, type ResolutionPlan } from "@third-chair/contracts";
export interface ResolvedPlan {
    readonly resolutions: readonly CheckResolution[];
    readonly nextRngCounter: number;
}
export declare function resolvePlan(seed: Uint8Array, campaignId: string, counter: number, rawPlan: ResolutionPlan): ResolvedPlan;
//# sourceMappingURL=dice.d.ts.map