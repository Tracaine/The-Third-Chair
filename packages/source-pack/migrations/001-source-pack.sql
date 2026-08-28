PRAGMA foreign_keys = ON;

CREATE TABLE source_pack_manifest (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE source_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL CHECK(page_count > 0),
  edition TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  permitted_kinds_json TEXT NOT NULL
);

CREATE TABLE source_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES source_documents(id),
  page_start INTEGER NOT NULL CHECK(page_start > 0),
  page_end INTEGER NOT NULL CHECK(page_end >= page_start),
  heading_path_json TEXT NOT NULL,
  edition TEXT NOT NULL,
  content_kind TEXT NOT NULL CHECK(content_kind IN ('MECHANICS','LORE','TIMELINE')),
  region TEXT,
  date_start_dr INTEGER,
  date_end_dr INTEGER,
  ocr_confidence REAL,
  confidence_status TEXT NOT NULL CHECK(confidence_status IN ('NATIVE_TEXT','REVIEWED','HIGH_CONFIDENCE','LOW_CONFIDENCE')),
  text TEXT NOT NULL,
  text_sha256 TEXT NOT NULL
);

CREATE VIRTUAL TABLE source_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  heading_path,
  aliases,
  text,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE source_reviews (
  chunk_id TEXT PRIMARY KEY REFERENCES source_chunks(id),
  reviewer TEXT NOT NULL,
  evidence TEXT NOT NULL,
  reviewed_at_utc TEXT NOT NULL
);

CREATE TRIGGER source_reviews_immutable_update BEFORE UPDATE ON source_reviews BEGIN SELECT RAISE(ABORT, 'SOURCE_REVIEW_IMMUTABLE'); END;
CREATE TRIGGER source_reviews_immutable_delete BEFORE DELETE ON source_reviews BEGIN SELECT RAISE(ABORT, 'SOURCE_REVIEW_IMMUTABLE'); END;

CREATE TABLE rule_sections (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES source_chunks(id),
  rule_key TEXT NOT NULL,
  category TEXT NOT NULL,
  UNIQUE(rule_key, chunk_id)
);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  region TEXT,
  valid_from_dr INTEGER,
  valid_to_dr INTEGER
);

CREATE TABLE entity_aliases (
  entity_id TEXT NOT NULL REFERENCES entities(id),
  alias TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY(entity_id, alias)
);

CREATE TABLE entity_mentions (
  entity_id TEXT NOT NULL REFERENCES entities(id),
  chunk_id TEXT NOT NULL REFERENCES source_chunks(id),
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  PRIMARY KEY(entity_id, chunk_id, start_offset)
);

CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  year_start_dr INTEGER NOT NULL,
  year_end_dr INTEGER NOT NULL,
  precision TEXT NOT NULL CHECK(precision IN ('EXACT','CIRCA','RANGE')),
  summary TEXT NOT NULL,
  chunk_id TEXT NOT NULL REFERENCES source_chunks(id)
);

CREATE TABLE timeline_edges (
  from_event_id TEXT NOT NULL REFERENCES timeline_events(id),
  to_event_id TEXT NOT NULL REFERENCES timeline_events(id),
  edge_type TEXT NOT NULL CHECK(edge_type IN ('CHRONOLOGICAL_NEXT','CHRONOLOGICAL_PREVIOUS','EXPLICIT_REFERENCE')),
  PRIMARY KEY(from_event_id, to_event_id, edge_type)
);

CREATE TABLE character_options (
  option_key TEXT PRIMARY KEY,
  option_kind TEXT NOT NULL CHECK(option_kind IN ('ANCESTRY','CLASS','BACKGROUND','EQUIPMENT','SPELL')),
  display_name TEXT NOT NULL,
  rule_section_id TEXT NOT NULL REFERENCES rule_sections(id),
  option_json TEXT NOT NULL
);

CREATE INDEX chunks_document_page_idx ON source_chunks(document_id, page_start, page_end);
CREATE INDEX chunks_region_date_idx ON source_chunks(region, date_start_dr, date_end_dr);
CREATE INDEX timeline_year_idx ON timeline_events(year_start_dr, year_end_dr);
CREATE INDEX aliases_value_idx ON entity_aliases(alias COLLATE NOCASE);
