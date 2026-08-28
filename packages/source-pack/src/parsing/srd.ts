import { createHash } from "node:crypto";
import type { RuleSection, SourceChunk } from "../indexing/types.js";
import { recognizeHeading, slugHeading } from "./headings.js";
import type { TextPage } from "./page-stream.js";

interface OpenSection { heading: string; pageStart: number; pageEnd: number; lines: string[] }

function hash(text: string): string { return createHash("sha256").update(text).digest("hex"); }

export function parseSrdPages(pages: readonly TextPage[]): { chunks: SourceChunk[]; ruleSections: RuleSection[]; characterOptions: [] } {
  const sections: OpenSection[] = [];
  let current: OpenSection | undefined;
  const finish = () => {
    if (!current) return;
    const body = current.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (body.length > current.heading.length) sections.push({ ...current, lines: [body] });
    current = undefined;
  };
  for (const page of pages) {
    for (const line of page.text.split("\n")) {
      const heading = recognizeHeading(line);
      if (heading) {
        finish();
        current = { heading, pageStart: page.page, pageEnd: page.page, lines: [heading] };
      } else if (current) {
        current.lines.push(line);
        if (line.trim()) current.pageEnd = page.page;
      }
    }
  }
  finish();

  const chunks: SourceChunk[] = [];
  const ruleSections: RuleSection[] = [];
  for (const section of sections) {
    const text = section.lines.join("\n");
    const textSha256 = hash(text);
    const ruleKey = slugHeading(section.heading);
    const id = ["srd-5.1", section.pageStart, ruleKey, textSha256.slice(0, 12)].join(":");
    chunks.push({ id, documentId: "srd-5.1", pageStart: section.pageStart, pageEnd: section.pageEnd,
      headingPath: [section.heading], edition: "SRD_5_1", contentKind: "MECHANICS",
      confidenceStatus: "NATIVE_TEXT", text, textSha256 });
    ruleSections.push({ id: `rule:${id}`, chunkId: id, ruleKey, category: "general" });
  }
  return { chunks, ruleSections, characterOptions: [] };
}
