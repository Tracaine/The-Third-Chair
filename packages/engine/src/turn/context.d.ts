import type { ActorIntent, WorldState } from "@third-chair/contracts";
export interface DirectorContext {
    readonly state: WorldState;
    readonly intents: readonly ActorIntent[];
}
export declare function buildDirectorContext(state: WorldState, intents: readonly ActorIntent[]): DirectorContext;
//# sourceMappingURL=context.d.ts.map