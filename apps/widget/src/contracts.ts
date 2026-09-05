import type { CheckResolution, PlayerView } from "@third-chair/contracts";

export interface VisibleCheck extends CheckResolution {
  readonly consequence?: string;
}

export interface TableViewModel {
  readonly playerView: PlayerView;
  readonly visibleChecks: readonly VisibleCheck[];
  readonly lastMutationId?: string;
  readonly serverStatus: "READY" | "RECONNECTING";
}

export interface WidgetPreferences {
  readonly theme: "system" | "light" | "dark";
}

export type EntityFact = PlayerView["facts"][number];

export function factsOfKind(
  facts: readonly EntityFact[],
  kind: string,
): EntityFact[] {
  const normalized = kind.toLocaleLowerCase();
  return facts.filter((fact) => fact.kind.toLocaleLowerCase() === normalized);
}

export function actorNameMap(view: PlayerView): Readonly<Record<string, string>> {
  return Object.fromEntries([
    ...view.actors.map((actor) => [actor.id, actor.name] as const),
    ...view.npcs.map((npc) => [npc.id, npc.name] as const),
  ]);
}
