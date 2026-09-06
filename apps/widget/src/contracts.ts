import type { PlayerView, TableViewPayload } from "@third-chair/contracts";

export type VisibleCheck = TableViewPayload["visibleChecks"][number];
export type TableViewModel = TableViewPayload;

export interface WidgetPreferences {
  readonly expandedPanelIds: readonly string[];
  readonly selectedTab: "story" | "party";
  readonly reducedMotion: boolean;
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
