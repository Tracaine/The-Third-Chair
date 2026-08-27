import { type DecisionRequest, type WorldState } from "@third-chair/contracts";
export declare function finalizeCandidateForCommit(input: {
    previous: WorldState;
    candidate: WorldState;
    proposedNextDecision: DecisionRequest;
    nextRngCounter: number;
}): {
    candidate: WorldState;
    nextDecision: DecisionRequest;
};
//# sourceMappingURL=finalize-candidate.d.ts.map