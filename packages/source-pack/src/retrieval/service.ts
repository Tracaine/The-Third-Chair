import type { DatabaseSync } from "node:sqlite";
import type { EntityResult, SourcePackManifestView, SourcePackService, SourceResult, TimelineResult } from "@third-chair/contracts";
import type { AliasConfig } from "../indexing/entities.js";
import aliases from "../../config/aliases.v1.json" with { type: "json" };
import { delimitSourceData, safeFtsQuery } from "./query.js";

interface ChunkRow {
  id: string; document_id: string; title: string; page_start: number; page_end: number; heading_path_json: string;
  edition: string; confidence_status: SourceResult["confidenceStatus"]; text: string;
}

const citation = (row: ChunkRow) => ({ documentId: row.document_id, title: row.title, pageStart: row.page_start,
  pageEnd: row.page_end, headingPath: JSON.parse(row.heading_path_json) as string[], edition: row.edition });

function boundPassages(results: SourceResult[], maximum: number): SourceResult[] {
  const bounded: SourceResult[] = []; let remaining = 12_000;
  for (const result of results.slice(0, maximum)) {
    if (remaining <= 0) break;
    const passage = result.passage.slice(0, remaining); remaining -= passage.length;
    bounded.push({ ...result, passage });
  }
  return bounded;
}

export class SqliteSourcePackService implements SourcePackService {
  constructor(private readonly db: DatabaseSync, private readonly aliases: AliasConfig) {}

  searchRules(input: { query: string; ruleKeys?: string[]; limit?: number }): SourceResult[] {
    const limit = Math.min(Math.max(input.limit ?? 6, 0), 6);
    if (limit === 0) return [];
    const rows = this.db.prepare(`SELECT c.*,d.title FROM source_chunks_fts f
      JOIN source_chunks c ON c.id=f.chunk_id JOIN source_documents d ON d.id=c.document_id
      WHERE source_chunks_fts MATCH ? AND c.document_id='srd-5.1' AND c.edition='SRD_5_1' AND c.content_kind='MECHANICS'
      ORDER BY bm25(source_chunks_fts),c.id LIMIT ?`).all(safeFtsQuery(input.query), limit) as unknown as ChunkRow[];
    return boundPassages(rows.map((row) => ({ kind: "RULE", id: row.id, passage: delimitSourceData(row.text), citation: citation(row),
      confidenceStatus: row.confidence_status })), 6);
  }

  searchLore(input: { query: string; region?: string; asOfDr?: number; entityIds?: string[]; limit?: number }): SourceResult[] {
    const limit = Math.min(Math.max(input.limit ?? 8, 0), 8); if (limit === 0) return [];
    const asOf = input.asOfDr ?? 1375;
    const rows = this.db.prepare(`SELECT c.*,d.title FROM source_chunks_fts f
      JOIN source_chunks c ON c.id=f.chunk_id JOIN source_documents d ON d.id=c.document_id
      WHERE source_chunks_fts MATCH ? AND c.content_kind='LORE' AND c.edition IN ('FRCS_3E_LORE_ONLY','FORGOTTEN_REALMS')
      AND (c.date_start_dr IS NULL OR c.date_start_dr<=?) AND (c.date_end_dr IS NULL OR c.date_end_dr<=?)
      AND (? IS NULL OR c.region=?)
      AND c.confidence_status!='LOW_CONFIDENCE'
      AND (c.confidence_status!='REVIEWED' OR EXISTS(SELECT 1 FROM source_reviews r WHERE r.chunk_id=c.id))
      ORDER BY bm25(source_chunks_fts),c.id LIMIT ?`).all(safeFtsQuery(input.query, this.aliases), asOf, asOf,
        input.region ?? null, input.region ?? null, limit) as unknown as ChunkRow[];
    return boundPassages(rows.map((row) => ({ kind: "LORE", id: row.id, passage: delimitSourceData(row.text), citation: citation(row),
      confidenceStatus: row.confidence_status })), 8);
  }

  searchTimeline(input: { query?: string; entityIds?: string[]; fromDr?: number; toDr?: number; limit?: number }): TimelineResult[] {
    const limit = Math.min(Math.max(input.limit ?? 20, 0), 20); if (limit === 0) return [];
    const from = input.fromDr ?? -100_000; const to = input.toDr ?? 1375;
    const queryClause = input.query ? "AND source_chunks_fts MATCH ?" : "";
    const sql = `SELECT e.id,e.year_start_dr,e.year_end_dr,e.precision,e.summary,c.document_id,c.page_start,c.page_end,
      c.heading_path_json,c.edition,c.confidence_status,c.text,d.title FROM timeline_events e
      JOIN source_chunks c ON c.id=e.chunk_id JOIN source_documents d ON d.id=c.document_id
      ${input.query ? "JOIN source_chunks_fts ON source_chunks_fts.chunk_id=c.id" : ""}
      WHERE e.year_end_dr>=? AND e.year_start_dr<=? ${queryClause}
      ORDER BY e.year_start_dr DESC,e.id LIMIT ?`;
    const args: Array<string | number> = [from, to]; if (input.query) args.push(safeFtsQuery(input.query)); args.push(limit);
    const rows = this.db.prepare(sql).all(...args) as unknown as Array<ChunkRow & { year_start_dr: number; year_end_dr: number; precision: TimelineResult["precision"]; summary: string }>;
    return rows.map((row) => ({ kind: "TIMELINE", id: row.id, yearStartDr: row.year_start_dr, yearEndDr: row.year_end_dr,
      precision: row.precision, summary: row.summary, citation: citation(row) }));
  }

  getEntity(input: { nameOrAlias: string; asOfDr?: number }): EntityResult | null {
    const asOf = input.asOfDr ?? 1375;
    const row = this.db.prepare(`SELECT DISTINCT e.id,e.canonical_name,e.entity_type,e.region FROM entities e
      LEFT JOIN entity_aliases a ON a.entity_id=e.id WHERE (e.canonical_name=? COLLATE NOCASE OR a.alias=? COLLATE NOCASE)
      AND (e.valid_from_dr IS NULL OR e.valid_from_dr<=?) AND (e.valid_to_dr IS NULL OR e.valid_to_dr>=?) LIMIT 1`)
      .get(input.nameOrAlias, input.nameOrAlias, asOf, asOf) as { id: string; canonical_name: string; entity_type: string; region: string | null } | undefined;
    if (!row) return null;
    const aliases = this.db.prepare("SELECT alias FROM entity_aliases WHERE entity_id=? ORDER BY alias COLLATE NOCASE").all(row.id)
      .map((item) => (item as { alias: string }).alias);
    return { id: row.id, canonicalName: row.canonical_name, entityType: row.entity_type, aliases, ...(row.region ? { region: row.region } : {}) };
  }

  manifest(): SourcePackManifestView {
    const rows = this.db.prepare("SELECT key,value_json FROM source_pack_manifest").all() as Array<{ key: string; value_json: string }>;
    const result = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value_json)])) as SourcePackManifestView;
    return result;
  }
}

export function createSqliteSourcePackService(db: DatabaseSync): SqliteSourcePackService {
  return new SqliteSourcePackService(db, aliases);
}
