# CHAIR-002 Private Source Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible, private, read-only SQLite source pack that retrieves bounded SRD 5.1 mechanics, 1375 DR-compatible Forgotten Realms lore, and dated timeline events with page provenance and explicit edition boundaries.

**Architecture:** An operator-only TypeScript CLI verifies immutable source manifests, streams page text through deterministic parsers, performs selective OCR for the scanned 3e setting book, builds FTS5 and temporal indexes in a temporary database, runs retrieval fixtures, and atomically promotes the database. Runtime retrieval opens it read-only and exposes typed, bounded results rather than documents.

**Tech Stack:** Node.js 24 LTS, TypeScript, Zod 4, Vitest, `node:sqlite` with FTS5, Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`), OCRmyPDF, and Tesseract.

**Spec:** `docs/superpowers/specs/2026-08-27-third-chair-design.md`

## Global Constraints

- Source inputs are read-only and remain under `project_sources/`; no task edits, replaces, optimizes, or annotates them.
- `source-pack.sqlite`, OCR output, page images, extracted text, caches, and temporary databases remain under ignored `private/` or `tmp/` paths.
- The source pack database and commercial source text never enter the plugin bundle, campaign database, SaveSet, or git history.
- SRD 5.1 is tagged `MECHANICS`; Forgotten Realms documents are tagged `LORE` or `TIMELINE`, never mechanical authority.
- V1 retrieval is FTS5 plus aliases, filters, and timeline edges; no embeddings or model-based extraction are added.
- The builder processes one page or one bounded chunk at a time and never sends a PDF or extracted corpus to a model.
- Runtime limits are six rule sections, eight lore chunks, twenty timeline events, and 12,000 returned source characters per call.
- The campaign cutoff is inclusive at 1375 DR.
- OCR confidence below 85 is `LOW_CONFIDENCE`; it cannot independently support an exact name, number, or rule-like claim.
- Every manual promotion to `REVIEWED` has durable provenance in `source_reviews`; the generic chunk writer cannot set that status directly.
- A successful build is atomic: failed verification or fixtures leave the previous promoted database unchanged.

---

### Task 1: Lock the Source Manifest and Operator CLI Boundary

**Files:**
- Create: `packages/source-pack/package.json`
- Create: `packages/source-pack/tsconfig.json`
- Create: `packages/source-pack/config/documents.v1.json`
- Create: `packages/source-pack/config/frcs-selection.v1.json`
- Create: `packages/source-pack/src/manifest.ts`
- Create: `packages/source-pack/src/process.ts`
- Create: `packages/source-pack/src/cli.ts`
- Create: `packages/source-pack/src/index.ts`
- Test: `packages/source-pack/test/manifest.test.ts`
- Test: `packages/source-pack/test/process.test.ts`

**Interfaces:**
- Consumes: repository-relative paths to the three authorized PDFs.
- Produces: `SourceDocumentConfigSchema`, `SourceManifest`, `verifySourceDocuments(config, root)`, `runProcess(command, args, options)`, and CLI commands `verify`, `build`, `query`, and `test-fixtures`.

- [ ] **Step 1: Write failing manifest tests**

Use tiny fixture files to prove hash mismatch, page-count mismatch, missing dependency, and path traversal fail before extraction. Also prove the manifest hash is independent of object key order.

```ts
await expect(verifySourceDocuments(badHashConfig, fixtureRoot)).rejects.toThrow("SOURCE_HASH_MISMATCH");
await expect(verifySourceDocuments(outsideRootConfig, fixtureRoot)).rejects.toThrow("SOURCE_PATH_OUTSIDE_ROOT");
expect(hashManifest(manifestA)).toBe(hashManifest(manifestB));
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/source-pack/test/manifest.test.ts packages/source-pack/test/process.test.ts`

Expected: FAIL.

- [ ] **Step 3: Create the exact document configuration**

```json
{
  "version": 1,
  "documents": [
    {
      "id": "srd-5.1",
      "title": "SRD-OGL_V5.1",
      "path": "project_sources/01-SRD-OGL_V5.1.pdf",
      "sha256": "d3f94417d2532f42a5abaec07e71a59007bf6cc46992c6458be6667f7a9f1e34",
      "pageCount": 403,
      "edition": "SRD_5_1",
      "permittedKinds": ["MECHANICS"],
      "method": "PDF_TEXT"
    },
    {
      "id": "grand-history",
      "title": "The Grand History of the Realms",
      "path": "project_sources/02-The-Grand-History-of-the-Realms-Forgotten-Realms-.pdf",
      "sha256": "a9bfa3139e7a63af6135f3ccfebb679fc63b6cf53f1d3f7dc70289b5b5078c09",
      "pageCount": 162,
      "edition": "FORGOTTEN_REALMS",
      "permittedKinds": ["TIMELINE", "LORE"],
      "method": "PDF_TEXT"
    },
    {
      "id": "frcs-3e",
      "title": "Forgotten Realms Campaign Setting 3rd Edition",
      "path": "project_sources/03-Forgotten-Realms-Campaign-Setting-3rd-Edition.pdf",
      "sha256": "5c550326746e77bddaa15d054e2ea592b74f5f26ea1e0731ad4ae793f1fd82ca",
      "pageCount": 320,
      "edition": "FRCS_3E_LORE_ONLY",
      "permittedKinds": ["LORE"],
      "method": "SELECTIVE_OCR"
    }
  ]
}
```

`frcs-selection.v1.json` contains three inclusive PDF/printed-page ranges with zero offset: 76–97 (`life-in-faerun`), 116–140 (`dalelands`), and 232–283 (`deities-history-organizations`). The builder verifies the printed number on the first page of every range before proceeding.

- [ ] **Step 4: Implement safe process and manifest verification**

Use `spawn()` or `execFile()` with an argument array and `shell: false`; never interpolate a source path into a shell command. Resolve each configured path against the supplied repository root and require it to remain below `project_sources/`. Stream SHA-256 with `createReadStream`, read page count from `pdfinfo`, and check `pdftotext`, `pdftoppm`, `ocrmypdf`, and `tesseract` with `--version`.

The manifest records document metadata, tool versions, selection and alias config hashes, build schema version, and UTC build time. Compute `sourcePackManifestHash` only from schema version, document IDs/hashes/page counts/editions, selection hash, and alias hash so an identical corpus rebuild retains campaign identity. Compute a separate `buildRecordHash` over tool versions, UTC build time, and the immutable identity fields. It never records absolute local paths.

- [ ] **Step 5: Add CLI argument validation and verify GREEN**

The CLI accepts only explicit subcommands and config/output flags parsed with Zod. Default output is `private/source-pack.sqlite`; default temporary parent is `tmp/source-pack-builds`. `verify` performs no writes. `build` refuses to overwrite the promoted database directly and delegates promotion to Task 8.

Run: `npm test -- packages/source-pack/test/manifest.test.ts packages/source-pack/test/process.test.ts && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/source-pack
git commit -m "feat: lock private source manifest"
```

---

### Task 2: Create the Source-Pack Database and FTS5 Index

**Files:**
- Create: `packages/source-pack/migrations/001-source-pack.sql`
- Create: `packages/source-pack/src/indexing/database.ts`
- Create: `packages/source-pack/src/indexing/writer.ts`
- Create: `packages/source-pack/src/indexing/types.ts`
- Test: `packages/source-pack/test/database.test.ts`
- Test: `packages/source-pack/test/fts.test.ts`

**Interfaces:**
- Consumes: verified `SourceManifest` and normalized document/chunk/entity/event records.
- Produces: `openSourcePackForBuild(path)`, `openSourcePackReadOnly(path)`, `SourcePackWriter`, and `assertSourcePackIntegrity(db)`.

- [ ] **Step 1: Write failing schema, FTS, and read-only tests**

Prove every chunk requires provenance, FTS finds `advantage` and an accented proper noun, a write through `openSourcePackReadOnly()` fails, the generic writer rejects a chunk initially labeled `REVIEWED`, a reviewed promotion requires a durable provenance record, and `PRAGMA integrity_check` plus `foreign_key_check` return clean results.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/source-pack/test/database.test.ts packages/source-pack/test/fts.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the exact source schema**

```sql
CREATE TABLE source_pack_manifest (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE source_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  edition TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  permitted_kinds_json TEXT NOT NULL
);

CREATE TABLE source_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES source_documents(id),
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
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

CREATE TABLE source_reviews (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES source_chunks(id),
  reviewer_id TEXT NOT NULL,
  basis TEXT NOT NULL CHECK(basis IN ('MANUAL_TEXT_VERIFICATION','SECOND_SOURCE_CORROBORATION')),
  evidence_ref TEXT NOT NULL,
  prior_status TEXT NOT NULL CHECK(prior_status IN ('HIGH_CONFIDENCE','LOW_CONFIDENCE')),
  resulting_status TEXT NOT NULL CHECK(resulting_status = 'REVIEWED'),
  reviewed_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE source_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  heading_path,
  aliases,
  text,
  tokenize='unicode61 remove_diacritics 2'
);

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
CREATE UNIQUE INDEX source_reviews_chunk_reviewed_idx ON source_reviews(chunk_id, resulting_status);
CREATE INDEX timeline_year_idx ON timeline_events(year_start_dr, year_end_dr);
CREATE INDEX aliases_value_idx ON entity_aliases(alias COLLATE NOCASE);
```

- [ ] **Step 4: Implement typed writer and read-only opening**

`SourcePackWriter` inserts source records inside bounded transactions of no more than 500 chunks. It writes FTS rows in the same transaction, rejects a chunk kind not allowed by its source document, and rejects `confidence_status: "REVIEWED"` on ordinary insert. `promoteChunkToReviewed(review)` inserts the immutable `source_reviews` row and updates the chunk status in one transaction after verifying the prior status, reviewer ID, basis, nonempty evidence reference, and timestamp. Read-only opening uses `{ readOnly: true }`, runs `PRAGMA query_only=ON`, and checks the manifest and schema version.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/source-pack/test/database.test.ts packages/source-pack/test/fts.test.ts && npm run typecheck`

```bash
git add packages/source-pack/migrations packages/source-pack/src/indexing packages/source-pack/test
git commit -m "feat: create private source pack index"
```

---

### Task 3: Extract and Section the SRD 5.1

**Files:**
- Create: `packages/source-pack/src/extraction/pdf-text.ts`
- Create: `packages/source-pack/src/parsing/page-stream.ts`
- Create: `packages/source-pack/src/parsing/headings.ts`
- Create: `packages/source-pack/src/parsing/srd.ts`
- Create: `packages/source-pack/test/fixtures/srd-pages.txt`
- Test: `packages/source-pack/test/srd-parser.test.ts`

**Interfaces:**
- Consumes: verified SRD document metadata and a page-delimited UTF-8 stream.
- Produces: `extractNativeTextPages(document)`, `parseSrdPages(pages)`, `SourceChunk[]`, `RuleSection[]`, and `CharacterOption[]`.

- [ ] **Step 1: Write failing page and heading reconstruction tests**

The synthetic fixture contains form-feed page breaks, a heading that continues across pages, a table, repeated headers/footers, and the phrases `Advantage and Disadvantage`, `Concentration`, and `Long Rest`. Assert page spans, heading paths, stable content hashes, and distinct rule keys.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/source-pack/test/srd-parser.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement streaming native extraction**

Call `spawn("pdftotext", ["-layout", "-enc", "UTF-8", "-f", "1", "-l", "403", documentPath, "-"])` with `shell: false`. Split on form feeds while preserving one-based PDF page numbers. Normalize CRLF, Unicode compatibility forms, soft hyphens, repeated blank lines, and known repeating headers/footers. Do not remove punctuation used in dice notation, formulas, or spell names.

- [ ] **Step 4: Implement deterministic section parsing**

Heading recognition uses typography-derived line rules only: short title-cased/all-caps lines surrounded by whitespace, numbered chapter markers, and a reviewed heading alias table. Chunk at semantic headings with a target of 1,500–4,000 characters, but never cross a top-level rule section. Tables stay with their introducing heading. Construct IDs as `["srd-5.1", pageStart, slug, textHash.slice(0, 12)].join(":")`.

Rule keys are normalized lowercase slugs such as `ability-checks`, `advantage-and-disadvantage`, `concentration`, and `long-rest`. Tag ancestry, class, background, equipment, and spell option sections into `character_options` only when the option is actually present in SRD 5.1.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/source-pack/test/srd-parser.test.ts && npm run typecheck`

```bash
git add packages/source-pack/src/extraction packages/source-pack/src/parsing packages/source-pack/test
git commit -m "feat: index srd rules with page provenance"
```

---

### Task 4: Parse Grand History Events and Temporal Edges

**Files:**
- Create: `packages/source-pack/src/parsing/dates.ts`
- Create: `packages/source-pack/src/parsing/grand-history.ts`
- Create: `packages/source-pack/src/indexing/timeline.ts`
- Create: `packages/source-pack/test/fixtures/grand-history-pages.txt`
- Test: `packages/source-pack/test/grand-history-parser.test.ts`
- Test: `packages/source-pack/test/timeline-edges.test.ts`

**Interfaces:**
- Consumes: page-delimited Grand History text.
- Produces: `parseRealmsDate(text)`, `parseGrandHistoryPages(pages)`, normalized timeline chunks/events, chronological edges, and explicit year-reference edges.

- [ ] **Step 1: Write failing date and event grouping tests**

Test exact `1375 DR`, circa `c. -339 DR`, ranges `1358–1368 DR`, multiple entries on one page, an entry continued to the next page, and prose containing `see 1372 DR`. Reject a bare number that lacks a DR marker.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/source-pack/test/grand-history-parser.test.ts packages/source-pack/test/timeline-edges.test.ts`

- [ ] **Step 3: Implement date normalization and event grouping**

Normalize BCE-style negative DR years as signed integers. Each dated heading begins a new event and consumes text until the next dated heading. An event spanning pages records the full page range. Preserve a concise deterministic summary made from the first complete sentence capped at 480 characters; retain full entry text only in its source chunk.

- [ ] **Step 4: Build temporal edges without a model**

Sort events by `(yearStartDr, yearEndDr, id)` and create bidirectional chronological neighbor edges. Parse explicit `see`, `from`, `until`, and `following the events of` references only when a DR year appears in the same sentence; link to every matching event for that year as `EXPLICIT_REFERENCE`. Store unresolved year references in a build diagnostic and fail fixtures if the target should exist.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/source-pack/test/grand-history-parser.test.ts packages/source-pack/test/timeline-edges.test.ts && npm run typecheck`

```bash
git add packages/source-pack/src/parsing packages/source-pack/src/indexing packages/source-pack/test
git commit -m "feat: build realms temporal graph"
```

---

### Task 5: OCR the Selected 3e Lore Pages with Confidence

**Files:**
- Create: `packages/source-pack/src/extraction/page-label.ts`
- Create: `packages/source-pack/src/extraction/ocr.ts`
- Create: `packages/source-pack/src/parsing/frcs.ts`
- Create: `packages/source-pack/src/indexing/source-review.ts`
- Create: `packages/source-pack/test/fixtures/frcs-page-high-confidence.tsv`
- Create: `packages/source-pack/test/fixtures/frcs-page-low-confidence.tsv`
- Test: `packages/source-pack/test/ocr-confidence.test.ts`
- Test: `packages/source-pack/test/ocr-review.test.ts`
- Test: `packages/source-pack/test/frcs-parser.test.ts`

**Interfaces:**
- Consumes: verified FRCS source and `frcs-selection.v1.json`.
- Produces: `verifyPrintedPageMapping`, `runSelectiveOcr`, `parseTesseractTsv`, `parseFrcsPages`, `OcrReviewRecordSchema`, `promoteChunkToReviewed`, lore chunks, and OCR diagnostics.

- [ ] **Step 1: Write failing confidence and page-range tests**

Assert only pages 76–97, 116–140, and 232–283 are selected; confidence ignores Tesseract rows with `conf=-1`; mean word confidence 84.99 is low and 85.00 is high; a mismatched printed page label aborts before OCR. Assert a low-confidence chunk cannot be promoted without reviewer identity, basis, evidence reference, and timestamp; successful promotion writes one immutable `source_reviews` record and changes status to `REVIEWED` in the same transaction; a duplicate or status-only promotion fails.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/source-pack/test/ocr-confidence.test.ts packages/source-pack/test/ocr-review.test.ts packages/source-pack/test/frcs-parser.test.ts`

- [ ] **Step 3: Verify page mapping before expensive work**

Render the bottom 20 percent of PDF pages 76, 116, and 232 at 300 DPI with `pdftoppm`; run Tesseract `--psm 6` on each crop; require the expected printed page number. Save only the diagnostic text and confidence under the temporary build directory. If any page fails, stop with `FRCS_PAGE_OFFSET_UNVERIFIED` and preserve the old source pack.

- [ ] **Step 4: Implement selective OCR**

Run OCRmyPDF against a temporary copy with:

```text
--pages 76-97,116-140,232-283
--deskew
--rotate-pages
--skip-text
--sidecar ${buildDir}/frcs.sidecar.txt
```

For confidence, render each selected page at 300 DPI and call `spawn("tesseract", [pagePng, "stdout", "--psm", "1", "tsv"])`. Parse word rows, compute mean confidence, and associate text boxes with the page. Delete page images and the OCR PDF after chunks are inserted and fixtures pass; retain no image in the promoted pack.

- [ ] **Step 5: Parse lore-only sections**

Reconstruct heading paths from the known section starts: `Life in Faerun`, `The Dalelands`, `Deities`, `History`, and `Organizations`. Tag all FRCS chunks `FRCS_3E_LORE_ONLY` and `LORE`, even when the page contains stat blocks, classes, feats, spells, item bonuses, DCs, or other rules-shaped text. A rules-shaped detector adds `containsEditionMechanics: true` to build diagnostics and excludes that paragraph from Director lore retrieval.

Manual review never edits extracted text in place. `promoteChunkToReviewed()` accepts the chunk ID plus an `OcrReviewRecord` containing opaque local reviewer ID, `MANUAL_TEXT_VERIFICATION` or `SECOND_SOURCE_CORROBORATION`, a stable evidence reference without copied source prose, the observed prior status, and an explicit review timestamp. It records provenance and promotion transactionally. Retrieval may trust `REVIEWED` only when the corresponding record exists.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- packages/source-pack/test/ocr-confidence.test.ts packages/source-pack/test/ocr-review.test.ts packages/source-pack/test/frcs-parser.test.ts && npm run typecheck`

```bash
git add packages/source-pack/src/extraction packages/source-pack/src/parsing packages/source-pack/test
git commit -m "feat: add selective confidence-aware lore ocr"
```

---

### Task 6: Resolve Entities, Aliases, Regions, and Edition Isolation

**Files:**
- Create: `packages/source-pack/config/aliases.v1.json`
- Create: `packages/source-pack/src/indexing/entities.ts`
- Create: `packages/source-pack/src/indexing/edition-boundary.ts`
- Test: `packages/source-pack/test/entities.test.ts`
- Test: `packages/source-pack/test/edition-isolation.test.ts`

**Interfaces:**
- Consumes: normalized source chunks and reviewed alias config.
- Produces: `indexEntities`, `expandAliases`, `classifyRulesShapedLore`, and `assertMechanicalAuthority`.

- [ ] **Step 1: Write failing alias and edition tests**

Fixture aliases include `Dalelands`/`the Dales`, `Zhentarim`/`Zhents`, `Harpers`/`Those Who Harp`, `Cormanthor`/`Elven Court`, and `Moonsea`/`Moonsea North`. Assert an alias search finds the canonical entity and does not create a second entity. Assert a FRCS prestige class, feat, spell statistic, and numeric armor bonus can never be returned by a rules query.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/source-pack/test/entities.test.ts packages/source-pack/test/edition-isolation.test.ts`

- [ ] **Step 3: Implement reviewed entity matching**

Use case-folded exact phrase matching against canonical names and aliases, longest match first, with Unicode word boundaries. Do not use fuzzy edit distance for entity creation. Unknown capitalized phrases remain text; they do not become entities automatically.

- [ ] **Step 4: Implement the edition firewall**

`assertMechanicalAuthority(chunk)` passes only when `document_id='srd-5.1'`, `edition='SRD_5_1'`, and `content_kind='MECHANICS'`. Rules-shaped FRCS paragraphs are marked and withheld from lore results unless a query explicitly asks for historical 3e game-design context, which is not exposed to the Director in V1.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/source-pack/test/entities.test.ts packages/source-pack/test/edition-isolation.test.ts && npm run typecheck`

```bash
git add packages/source-pack/config/aliases.v1.json packages/source-pack/src/indexing packages/source-pack/test
git commit -m "feat: enforce realms aliases and edition firewall"
```

---

### Task 7: Implement Bounded Rules, Lore, Entity, and Timeline Retrieval

**Files:**
- Create: `packages/contracts/src/sources.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/source-pack/src/retrieval/query.ts`
- Create: `packages/source-pack/src/retrieval/rules.ts`
- Create: `packages/source-pack/src/retrieval/lore.ts`
- Create: `packages/source-pack/src/retrieval/timeline.ts`
- Create: `packages/source-pack/src/retrieval/entities.ts`
- Create: `packages/source-pack/src/retrieval/service.ts`
- Test: `packages/source-pack/test/retrieval.test.ts`
- Test: `packages/source-pack/test/retrieval-bounds.test.ts`
- Test: `packages/source-pack/test/low-confidence.test.ts`

**Interfaces:**
- Consumes: read-only source database and typed query objects.
- Produces: `SourceCitationSchema`, `SourceResultSchema`, `SourcePackService`, `searchRules`, `searchLore`, `searchTimeline`, and `getEntity`.

- [ ] **Step 1: Write failing bounded retrieval tests**

Assert rule results never exceed six, lore never exceeds eight, timeline never exceeds twenty, combined returned passage text never exceeds 12,000 characters, all results cite title/pages/headings, post-1375 events are absent by default, and low-confidence exact-number results are suppressed without corroboration.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/source-pack/test/retrieval.test.ts packages/source-pack/test/retrieval-bounds.test.ts packages/source-pack/test/low-confidence.test.ts`

- [ ] **Step 3: Implement safe FTS query construction**

Tokenize the user's query, discard FTS operators and tokens longer than 64 characters, quote tokens, append reviewed alias expansions, and cap at twelve tokens. Do not pass raw query syntax to `MATCH`. Rank with `bm25`, exact heading hits, exact entity hits, region match, and temporal overlap.

- [ ] **Step 4: Implement typed retrieval methods**

```ts
export interface SourcePackService {
  searchRules(input: { query: string; ruleKeys?: string[]; limit?: number }): SourceResult[];
  searchLore(input: { query: string; region?: string; asOfDr: number; entityIds?: string[]; limit?: number }): SourceResult[];
  searchTimeline(input: { query?: string; entityIds?: string[]; fromDr?: number; toDr: number; limit?: number }): TimelineResult[];
  getEntity(input: { nameOrAlias: string; asOfDr: number }): EntityResult | null;
  manifest(): SourcePackManifestView;
}
```

Clamp caller limits to the system maxima. `searchRules` applies the edition firewall. `searchLore` defaults `asOfDr` to 1375 and excludes content valid only later. `searchTimeline` walks at most one edge hop unless the caller explicitly names a start event. Every text passage is delimited as untrusted source data when later supplied to a model.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/source-pack/test/retrieval*.test.ts packages/source-pack/test/low-confidence.test.ts && npm run typecheck`

```bash
git add packages/contracts packages/source-pack/src/retrieval packages/source-pack/test
git commit -m "feat: retrieve bounded sourced rules and lore"
```

---

### Task 8: Assemble, Evaluate, and Atomically Promote the Private Pack

**Files:**
- Create: `packages/source-pack/src/build.ts`
- Create: `packages/source-pack/src/promote.ts`
- Create: `packages/source-pack/test/fixtures/retrieval-cases.json`
- Create: `packages/source-pack/test/build-atomicity.test.ts`
- Create: `packages/source-pack/test/retrieval-fixtures.test.ts`
- Create: `docs/operations/source-pack.md`
- Create: `docs/operations/chair-002-gate.md`

**Interfaces:**
- Consumes: all builder stages and the three verified local PDFs.
- Produces: `buildSourcePack(options)`, `promoteSourcePack(tempPath, destination)`, private `source-pack.sqlite`, and a redacted build report.

- [ ] **Step 1: Write failing atomic-build and fixture tests**

Simulate a parser failure after chunks are written and assert the existing destination hash is unchanged. Retrieval fixtures cover advantage/disadvantage, concentration, long rest, death saves, cover, Shadowdale, Daggerdale, Zhentarim, Cormanthor, Harpers, and a timeline query ending at 1375 DR. Tests assert result kind, non-empty citation, page range, and edition—not copyrighted answer wording.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/source-pack/test/build-atomicity.test.ts packages/source-pack/test/retrieval-fixtures.test.ts`

- [ ] **Step 3: Implement the reproducible build pipeline**

Create a unique temporary directory with `mkdtemp`, build `source-pack.sqlite.pending`, insert manifest/documents/chunks/indexes, run `ANALYZE`, `PRAGMA optimize`, `integrity_check`, `foreign_key_check`, edition checks, confidence checks, and retrieval fixtures, then close the database. Compute its SHA-256 and write a redacted JSON report containing counts, pages processed, confidence distribution, fixture results, tool versions, and hashes—but no source passages.

- [ ] **Step 4: Implement atomic promotion**

If a destination exists, rename it to `source-pack.sqlite.previous` only after the pending database passes. Rename pending to destination on the same filesystem. If promotion fails, restore the previous name. Remove temporary extracted text and page images after a successful close; keep the redacted report.

- [ ] **Step 5: Run the private CHAIR-002 gate**

Run:

```bash
npm run source-pack -- verify --config packages/source-pack/config/documents.v1.json
npm run source-pack -- build --config packages/source-pack/config/documents.v1.json --output private/source-pack.sqlite
npm run source-pack -- test-fixtures --database private/source-pack.sqlite
npm run verify:private
npm run typecheck
npm test
```

Expected: hashes and page counts match; only the selected FRCS pages are OCRed; all retrieval fixtures pass; no post-1375 lore appears by default; no 3e mechanics appear as rules; the promoted database opens read-only; no private artifact is tracked.

- [ ] **Step 6: Document evidence and commit the gate**

`chair-002-gate.md` records only hashes, counts, confidence bands, commands, and PASS/FAIL outcomes.

```bash
git add packages/source-pack packages/contracts docs/operations/source-pack.md docs/operations/chair-002-gate.md
git commit -m "feat: deliver private realms source pack"
git tag chair-002-gate
```
