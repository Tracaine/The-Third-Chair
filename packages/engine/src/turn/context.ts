import type { ActorIntent, WorldState } from "@third-chair/contracts";
export interface DirectorContext { readonly state: WorldState; readonly intents: readonly ActorIntent[]; }
export function buildDirectorContext(state: WorldState, intents: readonly ActorIntent[]): DirectorContext { return { state: structuredClone(state), intents: structuredClone(intents) }; }
