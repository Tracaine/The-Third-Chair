import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

import { buildTimelineEdges } from "../src/indexing/timeline.js";
import { parseGrandHistoryPages } from "../src/parsing/grand-history.js";
import { parsePageStream } from "../src/parsing/page-stream.js";

const fixture = new URL("./fixtures/grand-history-pages.txt", import.meta.url);

async function parsed() { return parseGrandHistoryPages(parsePageStream(await readFile(fixture, "utf8"))); }

describe("timeline edges", () => {
  test("creates bidirectional edges between chronological neighbors", async () => {
    const result = await parsed();
    const edges = buildTimelineEdges(result.events, result.references);
    expect(edges.filter((item) => item.edgeType.startsWith("CHRONOLOGICAL"))).toHaveLength(6);
  });

  test("links only explicit trigger-plus-DR references", async () => {
    const result = await parsed();
    const edges = buildTimelineEdges(result.events, result.references);
    expect(edges.filter((item) => item.edgeType === "EXPLICIT_REFERENCE")).toHaveLength(2);
  });

  test("reports an unresolved explicit year without inventing a target", async () => {
    const result = await parsed();
    result.references.push({ fromEventId: result.events[0]!.id, yearDr: 9999 });
    const diagnostics: string[] = [];
    const edges = buildTimelineEdges(result.events, result.references, diagnostics);
    expect(edges.some((item) => item.edgeType === "EXPLICIT_REFERENCE" && item.toEventId.includes("9999"))).toBe(false);
    expect(diagnostics).toEqual(["UNRESOLVED_YEAR_REFERENCE:9999"]);
  });
});
