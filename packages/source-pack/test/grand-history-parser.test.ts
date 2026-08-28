import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

import { parseRealmsDate } from "../src/parsing/dates.js";
import { parseGrandHistoryPages } from "../src/parsing/grand-history.js";
import { parsePageStream } from "../src/parsing/page-stream.js";

const fixture = new URL("./fixtures/grand-history-pages.txt", import.meta.url);

describe("Grand History parsing", () => {
  test("normalizes exact, circa, and signed range dates", () => {
    expect(parseRealmsDate("1375 DR")).toEqual({ yearStartDr: 1375, yearEndDr: 1375, precision: "EXACT" });
    expect(parseRealmsDate("c. -339 DR")).toEqual({ yearStartDr: -339, yearEndDr: -339, precision: "CIRCA" });
    expect(parseRealmsDate("1358–1368 DR")).toEqual({ yearStartDr: 1358, yearEndDr: 1368, precision: "RANGE" });
  });

  test("rejects undressed numbers", () => {
    expect(parseRealmsDate("The number 1375 appears.")).toBeUndefined();
  });

  test("groups a dated event across page boundaries with a deterministic first-sentence summary", async () => {
    const result = parseGrandHistoryPages(parsePageStream(await readFile(fixture, "utf8")));
    expect(result.events).toHaveLength(4);
    const event = result.events.find((item) => item.yearStartDr === 1375)!;
    expect(result.chunks.find((item) => item.id === event.chunkId)).toMatchObject({ pageStart: 2, pageEnd: 3 });
    expect(event.summary).toBe("A final event began and continued into the next page.");
  });
});
