import type { DatabaseSync } from "node:sqlite";
import aliases from "../config/aliases.v1.json" with { type: "json" };
import { openSourcePackForBuild } from "../src/indexing/database.js";
import { SourcePackWriter } from "../src/indexing/writer.js";
import type { SourceChunk, SourceDocumentRecord, TimelineEvent } from "../src/indexing/types.js";
import { SqliteSourcePackService } from "../src/retrieval/service.js";

const documents: SourceDocumentRecord[] = [
  { id: "srd-5.1", title: "SRD 5.1", sha256: "a".repeat(64), pageCount: 403, edition: "SRD_5_1", extractionMethod: "PDF_TEXT", permittedKinds: ["MECHANICS"] },
  { id: "frcs-3e", title: "FRCS", sha256: "b".repeat(64), pageCount: 320, edition: "FRCS_3E_LORE_ONLY", extractionMethod: "SELECTIVE_OCR", permittedKinds: ["LORE"] },
  { id: "grand-history", title: "Grand History", sha256: "c".repeat(64), pageCount: 162, edition: "FORGOTTEN_REALMS", extractionMethod: "PDF_TEXT", permittedKinds: ["TIMELINE", "LORE"] },
];

const hash = (index: number) => index.toString(16).padStart(64, "0");

export function createRetrievalFixture(): { db: DatabaseSync; service: SqliteSourcePackService } {
  const db = openSourcePackForBuild(":memory:"); const writer = new SourcePackWriter(db);
  documents.forEach((document) => writer.insertDocument(document));
  writer.insertManifest({ sourcePackManifestHash: "fixture-manifest" });
  const ruleTerms = ["advantage", "concentration", "long rest", "death saving throws", "cover"];
  const rules: SourceChunk[] = Array.from({ length: 10 }, (_, index) => ({ id: `rule-${index}`, documentId: "srd-5.1",
    pageStart: index + 1, pageEnd: index + 1, headingPath: [index < 6 ? "Advantage" : ruleTerms[index % ruleTerms.length]!], edition: "SRD_5_1", contentKind: "MECHANICS",
    confidenceStatus: "NATIVE_TEXT", text: `${index < 6 ? "advantage" : ruleTerms[index % ruleTerms.length]} rule passage ${index} ${"x".repeat(1800)}`, textSha256: hash(index + 1) }));
  writer.insertChunks(rules);
  writer.insertRuleSections(rules.map((chunk, index) => ({ id: `section-${index}`, chunkId: chunk.id, ruleKey: "advantage-and-disadvantage", category: "checks" })));
  const loreTerms = ["Shadowdale", "Daggerdale", "Zhentarim Zhents", "Cormanthor", "Harpers"];
  const lore: SourceChunk[] = Array.from({ length: 12 }, (_, index) => ({ id: `lore-${index}`, documentId: "frcs-3e",
    pageStart: 116 + index, pageEnd: 116 + index, headingPath: ["The Dalelands"], edition: "FRCS_3E_LORE_ONLY", contentKind: "LORE",
    region: "Dalelands", dateEndDr: 1375, ocrConfidence: 90, confidenceStatus: "HIGH_CONFIDENCE",
    text: `${loreTerms[index % loreTerms.length]} influence the Dalelands lore passage ${index}.`, textSha256: hash(20 + index) }));
  writer.insertChunks(lore);
  writer.insertChunks([{ id: "low-number", documentId: "frcs-3e", pageStart: 140, pageEnd: 140, headingPath: ["The Dalelands"],
    edition: "FRCS_3E_LORE_ONLY", contentKind: "LORE", ocrConfidence: 70, confidenceStatus: "LOW_CONFIDENCE",
    text: "The exact hidden number is 4242.", textSha256: hash(40) }]);
  writer.insertChunks([{ id: "fake-reviewed", documentId: "frcs-3e", pageStart: 141, pageEnd: 141, headingPath: ["The Dalelands"],
    edition: "FRCS_3E_LORE_ONLY", contentKind: "LORE", ocrConfidence: 70, confidenceStatus: "REVIEWED",
    text: "The exact false number is 5151.", textSha256: hash(41) }]);
  const timelineChunks: SourceChunk[] = Array.from({ length: 25 }, (_, index) => {
    const year = 1352 + index;
    return { id: `timeline-${index}`, documentId: "grand-history", pageStart: index + 1, pageEnd: index + 1,
      headingPath: [`${year} DR`], edition: "FORGOTTEN_REALMS", contentKind: "TIMELINE", dateStartDr: year, dateEndDr: year,
      confidenceStatus: "NATIVE_TEXT", text: `${year} DR Dalelands event.`, textSha256: hash(50 + index) };
  });
  writer.insertChunks(timelineChunks);
  const events: TimelineEvent[] = timelineChunks.map((chunk, index) => ({ id: `event-${index}`, yearStartDr: 1352 + index,
    yearEndDr: 1352 + index, precision: "EXACT", summary: `Event ${index}`, chunkId: chunk.id }));
  writer.insertTimeline(events, []);
  writer.insertEntities([{ id: "zhentarim", canonicalName: "Zhentarim", entityType: "ORGANIZATION", aliases: ["Zhents"] }],
    [{ entityId: "zhentarim", chunkId: "lore-0", startOffset: 4, endOffset: 10 }]);
  return { db, service: new SqliteSourcePackService(db, aliases) };
}
