import { type WorldOperation, type WorldState } from "@third-chair/contracts";
import { type OperationContext } from "./validate.js";
export interface OperationAudit {
    readonly operationId: string;
    readonly kind: WorldOperation["kind"];
}
export interface AppliedOperations {
    readonly candidate: WorldState;
    readonly audit: readonly OperationAudit[];
}
export declare function applyOperationsToClone(state: WorldState, operations: readonly WorldOperation[], context: OperationContext): AppliedOperations;
//# sourceMappingURL=apply.d.ts.map