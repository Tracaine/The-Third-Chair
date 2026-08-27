import { type ActorIntent, type CheckResolution, type WorldOperation, type WorldState } from "@third-chair/contracts";
export interface OperationContext {
    readonly intents: readonly ActorIntent[];
    readonly resolutions: readonly CheckResolution[];
}
export declare function validateOperation(state: WorldState, raw: WorldOperation, context: OperationContext): WorldOperation;
//# sourceMappingURL=validate.d.ts.map