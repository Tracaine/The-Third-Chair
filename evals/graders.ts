export type EvalExpectation = "NO_ROLL" | "ROLL" | "AWAITING_RECOVERY" | "REUSED_ROLL";
export interface EvalEvidence {
  readonly finalKind: string;
  readonly rollCount: number;
  readonly rngCounter: number;
  readonly beforeDice?: readonly (readonly number[])[] | null;
  readonly afterDice?: readonly (readonly number[])[] | null;
}

export function gradeChair003(expectation: EvalExpectation, evidence: EvalEvidence): boolean {
  if (expectation === "NO_ROLL") return evidence.finalKind === "COMMITTED" && evidence.rollCount === 0 && evidence.rngCounter === 0;
  if (expectation === "ROLL") return evidence.finalKind === "COMMITTED" && evidence.rollCount > 0 && evidence.rngCounter > 0;
  if (expectation === "AWAITING_RECOVERY") return evidence.finalKind === "AWAITING_INPUT" && evidence.rollCount > 0 && evidence.rngCounter === 0;
  return evidence.finalKind === "COMMITTED" && evidence.rollCount > 0
    && JSON.stringify(evidence.beforeDice) === JSON.stringify(evidence.afterDice);
}
