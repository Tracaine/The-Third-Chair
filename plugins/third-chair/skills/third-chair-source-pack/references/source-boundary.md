# Source Pack Boundary

Read this reference when selecting or changing source inputs, interpreting a build failure, or auditing private output.

## Config and schema

`packages/source-pack/config/documents.v1.json` is a version-1 object with a non-empty `documents` array. Each document declares `id`, `title`, repository-relative `path`, SHA-256, positive `pageCount`, edition, permitted content kinds, and extraction method. Paths must be relative, resolve beneath the real `project_sources/` directory, and remain there after symlink resolution.

The promoted database contains manifest/document metadata, source chunks plus FTS5, immutable review rows, SRD rule sections and character options, entities/aliases/mentions, and timeline events/edges. Runtime opens it read-only with SQLite query-only mode.

## Authority

- `SRD_5_1` may provide mechanics.
- `FORGOTTEN_REALMS` may provide lore and timeline.
- `FRCS_3E_LORE_ONLY` may provide lore only, even where source pages resemble mechanics.
- Setting retrieval defaults through 1375 DR.
- OCR confidence below 85 cannot independently support exact names, numbers, or rules-shaped claims.

## Build containment

Verification computes hashes and page counts before extraction and records no absolute local paths. The FRCS selection is limited to PDF pages 76–97, 116–140, and 232–283; configured anchors must verify the zero-offset page mapping before OCR. Builds assemble in a unique temporary directory and promote atomically only after integrity and retrieval fixtures pass.

Original documents, extracted text, page images, OCR output, private reports, caches, temporary databases, and the promoted SQLite database stay in ignored `project_sources/`, `private/`, or `tmp/` locations. They are never plugin contents or Git history.
