import { describe, expect, test } from "vitest";

import { openSourcePackForBuild } from "../src/indexing/database.js";
import { SourcePackWriter } from "../src/indexing/writer.js";
import type { SourceChunk, SourceDocumentRecord } from "../src/indexing/types.js";

const document: SourceDocumentRecord = {
  id: "srd-5.1", title: "SRD", sha256: "a".repeat(64), pageCount: 3,
  edition: "SRD_5_1", extractionMethod: "PDF_TEXT", permittedKinds: ["MECHANICS"],
};

function sourceChunk(id: string, text: string): SourceChunk {
  return { id, documentId: document.id, pageStart: 1, pageEnd: 1, headingPath: ["Ability Checks"],
    edition: "SRD_5_1", contentKind: "MECHANICS", confidenceStatus: "NATIVE_TEXT",
    text, textSha256: id.padEnd(64, "0") };
}

describe("source pack FTS", () => {
  test("indexes chunks transactionally for lexical search", () => {
    const db = openSourcePackForBuild(":memory:");
    try {
      const writer = new SourcePackWriter(db); writer.insertDocument(document);
      writer.insertChunks([sourceChunk("one", "Roll with advantage when appropriate.")]);
      expect(db.prepare("SELECT chunk_id FROM source_chunks_fts WHERE source_chunks_fts MATCH ?").all("advantage"))
        .toEqual([{ chunk_id: "one" }]);
    } finally { db.close(); }
  });

  test("FTS removes diacritics for proper-noun lookup", () => {
    const db = openSourcePackForBuild(":memory:");
    try {
      const writer = new SourcePackWriter(db); writer.insertDocument(document);
      writer.insertChunks([sourceChunk("two", "The city of Myth Drannór is named here.")]);
      expect(db.prepare("SELECT chunk_id FROM source_chunks_fts WHERE source_chunks_fts MATCH ?").all("drannor"))
        .toEqual([{ chunk_id: "two" }]);
    } finally { db.close(); }
  });
});
