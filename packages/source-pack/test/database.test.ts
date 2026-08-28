import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  assertSourcePackIntegrity,
  openSourcePackForBuild,
  openSourcePackReadOnly,
} from "../src/indexing/database.js";
import { SourcePackWriter } from "../src/indexing/writer.js";
import type { SourceChunk, SourceDocumentRecord } from "../src/indexing/types.js";

const document: SourceDocumentRecord = {
  id: "srd-5.1", title: "SRD", sha256: "a".repeat(64), pageCount: 1,
  edition: "SRD_5_1", extractionMethod: "PDF_TEXT", permittedKinds: ["MECHANICS"],
};
const chunk: SourceChunk = {
  id: "chunk-1", documentId: "srd-5.1", pageStart: 1, pageEnd: 1,
  headingPath: ["Rules"], edition: "SRD_5_1", contentKind: "MECHANICS",
  confidenceStatus: "NATIVE_TEXT", text: "Advantage applies.", textSha256: "b".repeat(64),
};

describe("source pack database", () => {
  test("rejects chunks without valid page provenance", () => {
    const db = openSourcePackForBuild(":memory:");
    try {
      const writer = new SourcePackWriter(db);
      writer.insertDocument(document);
      expect(() => writer.insertChunks([{ ...chunk, pageStart: 0 }])).toThrow();
    } finally { db.close(); }
  });

  test("rejects a content kind not permitted by its document", () => {
    const db = openSourcePackForBuild(":memory:");
    try {
      const writer = new SourcePackWriter(db);
      writer.insertDocument(document);
      expect(() => writer.insertChunks([{ ...chunk, contentKind: "LORE" }])).toThrow("SOURCE_KIND_NOT_PERMITTED");
    } finally { db.close(); }
  });

  test("requires an immutable review row before REVIEWED promotion", () => {
    const db = openSourcePackForBuild(":memory:");
    try {
      const writer = new SourcePackWriter(db);
      writer.insertDocument(document);
      writer.insertChunks([{ ...chunk, confidenceStatus: "LOW_CONFIDENCE" }]);
      expect(() => writer.promoteReviewedChunk(chunk.id, { reviewer: "Bill", evidence: "page checked" }))
        .not.toThrow();
      expect(db.prepare("SELECT confidence_status FROM source_chunks WHERE id=?").get(chunk.id))
        .toEqual({ confidence_status: "REVIEWED" });
      expect(() => writer.promoteReviewedChunk(chunk.id, { reviewer: "Bill", evidence: "changed" }))
        .toThrow("SOURCE_REVIEW_IMMUTABLE");
    } finally { db.close(); }
  });

  test("opens promoted packs read-only and passes integrity checks", () => {
    const directory = mkdtempSync(join(tmpdir(), "source-pack-db-"));
    const path = join(directory, "source-pack.sqlite");
    const build = openSourcePackForBuild(path);
    new SourcePackWriter(build).insertDocument(document);
    assertSourcePackIntegrity(build);
    build.close();
    const read = openSourcePackReadOnly(path);
    try {
      expect(() => read.exec("CREATE TABLE forbidden(x)")).toThrow();
      assertSourcePackIntegrity(read);
    } finally { read.close(); rmSync(directory, { recursive: true, force: true }); }
  });
});
