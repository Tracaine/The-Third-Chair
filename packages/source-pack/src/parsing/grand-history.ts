import { createHash } from "node:crypto";
import type { SourceChunk, TimelineEvent } from "../indexing/types.js";
import { parseRealmsDate, type RealmsDate } from "./dates.js";
import type { TextPage } from "./page-stream.js";

export interface YearReference { fromEventId: string; yearDr: number }
interface OpenEvent { date: RealmsDate; heading: string; pageStart: number; pageEnd: number; body: string[] }

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

function summary(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  const sentence = /^(.+?[.!?])(?:\s|$)/.exec(normalized)?.[1] ?? normalized;
  return sentence.slice(0, 480);
}

export function parseGrandHistoryPages(pages: readonly TextPage[]): {
  chunks: SourceChunk[]; events: TimelineEvent[]; references: YearReference[];
} {
  const groups: OpenEvent[] = [];
  let current: OpenEvent | undefined;
  const finish = () => { if (current && current.body.join(" ").trim()) groups.push(current); current = undefined; };
  for (const page of pages) {
    for (const rawLine of page.text.split("\n")) {
      const line = rawLine.trim();
      const date = parseRealmsDate(line);
      if (date) { finish(); current = { date, heading: line, pageStart: page.page, pageEnd: page.page, body: [] }; }
      else if (current) { current.body.push(rawLine); if (line) current.pageEnd = page.page; }
    }
  }
  finish();

  const chunks: SourceChunk[] = [];
  const events: TimelineEvent[] = [];
  const references: YearReference[] = [];
  for (const group of groups) {
    const body = group.body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const text = `${group.heading}\n${body}`;
    const textSha256 = sha(text);
    const id = `grand-history:${group.pageStart}:${group.date.yearStartDr}:${textSha256.slice(0, 12)}`;
    const eventId = `event:${id}`;
    chunks.push({ id, documentId: "grand-history", pageStart: group.pageStart, pageEnd: group.pageEnd,
      headingPath: [group.heading], edition: "FORGOTTEN_REALMS", contentKind: "TIMELINE",
      dateStartDr: group.date.yearStartDr, dateEndDr: group.date.yearEndDr,
      confidenceStatus: "NATIVE_TEXT", text, textSha256 });
    events.push({ id: eventId, yearStartDr: group.date.yearStartDr, yearEndDr: group.date.yearEndDr,
      precision: group.date.precision, summary: summary(body), chunkId: id });
    for (const sentence of body.match(/[^.!?]*[.!?]|[^.!?]+$/g) ?? []) {
      const pattern = /\b(?:see|from|until|following the events of)\s+(?:c\.\s*)?(-?\d{1,5})\s*DR\b/gi;
      for (const match of sentence.matchAll(pattern)) references.push({ fromEventId: eventId, yearDr: Number(match[1]) });
    }
  }
  return { chunks, events, references };
}
