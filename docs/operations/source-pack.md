# Private Source Pack Operations

The CHAIR-002 source pack is an operator-built, read-only SQLite database. It is never committed or bundled with the plugin.

## Private inputs

Place the three authorized PDFs under the ignored `project_sources/` directory using the exact paths in `packages/source-pack/config/documents.v1.json`. Keep them read-only. Extracted text, page images, OCR output, reports, and databases belong only under ignored `private/` or `tmp/` paths.

The builder requires Node.js 24 LTS, `pdfinfo`, `pdftotext`, `pdftoppm`, OCRmyPDF, and Tesseract. It invokes subprocesses with argument arrays and `shell: false`.

## Commands

From the repository root:

```text
npm run source-pack -- verify --config packages/source-pack/config/documents.v1.json
npm run source-pack -- build --config packages/source-pack/config/documents.v1.json --output private/source-pack.sqlite
npm run source-pack -- test-fixtures --database private/source-pack.sqlite
npm run verify:private
npm run typecheck
npm test
npm run build
```

`build` verifies source hashes and page counts before extraction, builds in a unique temporary directory, runs integrity and retrieval fixtures, then atomically promotes the pending database. A failed build leaves the existing destination unchanged. When replacing a pack, the prior database is retained as `source-pack.sqlite.previous`.

## Authority boundaries

- SRD 5.1 is the sole mechanical authority.
- Forgotten Realms sources provide lore and timeline data only.
- Default setting retrieval is inclusive through 1375 DR.
- OCR below 85 is `LOW_CONFIDENCE` and cannot independently support exact facts.
- `REVIEWED` is trusted only with its immutable review row.
- Runtime results are bounded to 6 rules, 8 lore chunks, 20 timeline events, and 12,000 returned source characters.

## FRCS page mapping

This scan has no reliable printed folios at the three selection starts. The reviewed mapping gate therefore renders the complete PDF pages at 300 DPI and requires both non-prose anchor phrases configured for pages 76, 116, and 232. The PDF/printed-page mapping remains zero-offset. Any missing anchor stops before selective OCR with `FRCS_PAGE_OFFSET_UNVERIFIED`.

## Privacy audit

Before checkpointing, confirm `git ls-files project_sources private tmp` returns no paths and run `npm run verify:private`. Build reports are redacted and contain no source passages.
