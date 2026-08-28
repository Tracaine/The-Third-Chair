import type { DatabaseSync } from "node:sqlite";
import type { EntityRecord, RuleSection, SourceChunk, SourceDocumentRecord, TimelineEdge, TimelineEvent } from "./types.js";

export class SourcePackWriter {
  constructor(private readonly db: DatabaseSync) {}

  insertManifest(values: Record<string, unknown>): void {
    const insert = this.db.prepare("INSERT OR REPLACE INTO source_pack_manifest(key,value_json) VALUES (?,?)");
    for (const [key, value] of Object.entries(values)) insert.run(key, JSON.stringify(value));
  }

  insertDocument(document: SourceDocumentRecord): void {
    this.db.prepare(`INSERT INTO source_documents(id,title,sha256,page_count,edition,extraction_method,permitted_kinds_json)
      VALUES (?,?,?,?,?,?,?)`).run(document.id, document.title, document.sha256, document.pageCount, document.edition,
        document.extractionMethod, JSON.stringify(document.permittedKinds));
  }

  insertChunks(chunks: readonly SourceChunk[]): void {
    for (let offset = 0; offset < chunks.length; offset += 500) this.insertChunkBatch(chunks.slice(offset, offset + 500));
  }

  private insertChunkBatch(chunks: readonly SourceChunk[]): void {
    const insert = this.db.prepare(`INSERT INTO source_chunks(
      id,document_id,page_start,page_end,heading_path_json,edition,content_kind,region,date_start_dr,date_end_dr,
      ocr_confidence,confidence_status,text,text_sha256) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insertFts = this.db.prepare("INSERT INTO source_chunks_fts(chunk_id,heading_path,aliases,text) VALUES (?,?,?,?)");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const chunk of chunks) {
        const row = this.db.prepare("SELECT permitted_kinds_json FROM source_documents WHERE id=?").get(chunk.documentId) as { permitted_kinds_json?: string } | undefined;
        const permitted = row?.permitted_kinds_json ? JSON.parse(row.permitted_kinds_json) as string[] : [];
        if (!permitted.includes(chunk.contentKind)) throw new Error("SOURCE_KIND_NOT_PERMITTED");
        insert.run(chunk.id, chunk.documentId, chunk.pageStart, chunk.pageEnd, JSON.stringify(chunk.headingPath), chunk.edition,
          chunk.contentKind, chunk.region ?? null, chunk.dateStartDr ?? null, chunk.dateEndDr ?? null,
          chunk.ocrConfidence ?? null, chunk.confidenceStatus, chunk.text, chunk.textSha256);
        insertFts.run(chunk.id, chunk.headingPath.join(" > "), (chunk.aliases ?? []).join(" "), chunk.text);
      }
      this.db.exec("COMMIT");
    } catch (error) { if (this.db.isTransaction) this.db.exec("ROLLBACK"); throw error; }
  }

  promoteReviewedChunk(chunkId: string, review: { reviewer: string; evidence: string }): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.db.prepare("SELECT 1 AS present FROM source_reviews WHERE chunk_id=?").get(chunkId)) throw new Error("SOURCE_REVIEW_IMMUTABLE");
      this.db.prepare("INSERT INTO source_reviews(chunk_id,reviewer,evidence,reviewed_at_utc) VALUES (?,?,?,?)")
        .run(chunkId, review.reviewer, review.evidence, new Date().toISOString());
      this.db.prepare("UPDATE source_chunks SET confidence_status='REVIEWED' WHERE id=?").run(chunkId);
      this.db.exec("COMMIT");
    } catch (error) { if (this.db.isTransaction) this.db.exec("ROLLBACK"); throw error; }
  }

  insertRuleSections(items: readonly RuleSection[]): void {
    const statement = this.db.prepare("INSERT INTO rule_sections(id,chunk_id,rule_key,category) VALUES (?,?,?,?)");
    for (const item of items) statement.run(item.id, item.chunkId, item.ruleKey, item.category);
  }

  insertTimeline(events: readonly TimelineEvent[], edges: readonly TimelineEdge[]): void {
    const eventStatement = this.db.prepare("INSERT INTO timeline_events(id,year_start_dr,year_end_dr,precision,summary,chunk_id) VALUES (?,?,?,?,?,?)");
    const edgeStatement = this.db.prepare("INSERT OR IGNORE INTO timeline_edges(from_event_id,to_event_id,edge_type) VALUES (?,?,?)");
    for (const item of events) eventStatement.run(item.id, item.yearStartDr, item.yearEndDr, item.precision, item.summary, item.chunkId);
    for (const edge of edges) edgeStatement.run(edge.fromEventId, edge.toEventId, edge.edgeType);
  }

  insertEntities(entities: readonly EntityRecord[], mentions: readonly { entityId: string; chunkId: string; startOffset: number; endOffset: number }[]): void {
    const entityStatement = this.db.prepare("INSERT INTO entities(id,canonical_name,entity_type,region,valid_from_dr,valid_to_dr) VALUES (?,?,?,?,?,?)");
    const aliasStatement = this.db.prepare("INSERT INTO entity_aliases(entity_id,alias) VALUES (?,?)");
    const mentionStatement = this.db.prepare("INSERT INTO entity_mentions(entity_id,chunk_id,start_offset,end_offset) VALUES (?,?,?,?)");
    for (const entity of entities) {
      entityStatement.run(entity.id, entity.canonicalName, entity.entityType, entity.region ?? null, entity.validFromDr ?? null, entity.validToDr ?? null);
      for (const alias of entity.aliases) aliasStatement.run(entity.id, alias);
    }
    for (const mention of mentions) mentionStatement.run(mention.entityId, mention.chunkId, mention.startOffset, mention.endOffset);
  }
}
