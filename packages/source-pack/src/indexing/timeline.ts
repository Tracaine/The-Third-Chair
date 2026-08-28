import type { TimelineEdge, TimelineEvent } from "./types.js";
import type { YearReference } from "../parsing/grand-history.js";

export function buildTimelineEdges(
  events: readonly TimelineEvent[],
  references: readonly YearReference[],
  diagnostics: string[] = [],
): TimelineEdge[] {
  const ordered = [...events].sort((a, b) => a.yearStartDr - b.yearStartDr || a.yearEndDr - b.yearEndDr || a.id.localeCompare(b.id));
  const edges: TimelineEdge[] = [];
  for (let index = 0; index + 1 < ordered.length; index++) {
    const current = ordered[index]!; const next = ordered[index + 1]!;
    edges.push({ fromEventId: current.id, toEventId: next.id, edgeType: "CHRONOLOGICAL_NEXT" });
    edges.push({ fromEventId: next.id, toEventId: current.id, edgeType: "CHRONOLOGICAL_PREVIOUS" });
  }
  for (const reference of references) {
    const targets = events.filter((event) => reference.yearDr >= event.yearStartDr && reference.yearDr <= event.yearEndDr);
    if (targets.length === 0) diagnostics.push(`UNRESOLVED_YEAR_REFERENCE:${reference.yearDr}`);
    for (const target of targets) edges.push({ fromEventId: reference.fromEventId, toEventId: target.id, edgeType: "EXPLICIT_REFERENCE" });
  }
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.fromEventId}\0${edge.toEventId}\0${edge.edgeType}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}
