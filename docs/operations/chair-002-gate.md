# CHAIR-002 Gate

**Status:** PASS  
**Date:** 2026-08-28  
**Branch:** `chair-002-source-pack`

## Source identity

| Document | Pages | SHA-256 |
| --- | ---: | --- |
| SRD-OGL_V5.1 | 403 | `d3f94417d2532f42a5abaec07e71a59007bf6cc46992c6458be6667f7a9f1e34` |
| The Grand History of the Realms | 162 | `a9bfa3139e7a63af6135f3ccfebb679fc63b6cf53f1d3f7dc70289b5b5078c09` |
| Forgotten Realms Campaign Setting 3rd Edition | 320 | `5c550326746e77bddaa15d054e2ea592b74f5f26ea1e0731ad4ae793f1fd82ca` |

- Source-pack manifest SHA-256: `6a9017afa7550486c0523956ce717827e51f8afcb1a7b7f976b710450b72ebf0`
- Promoted database SHA-256: `0544cbd10b6320986994a46d37f555698b9a932b9ff2d676834a5ec6a3ad0dbf`
- Promoted database opened read-only: PASS

## Build evidence

| Measure | Result |
| --- | ---: |
| Documents | 3 |
| Total chunks | 4,036 |
| SRD rule sections | 323 |
| Entities | 7 |
| Entity mentions | 618 |
| Timeline events | 408 |
| Timeline edges | 815 |
| SRD pages processed | 403 |
| Grand History pages processed | 162 |
| FRCS pages selectively OCRed | 99 |
| Native-text chunks | 731 |
| High-confidence OCR chunks | 3,241 |
| Low-confidence OCR chunks | 64 |
| Retrieval fixtures | 11 / 11 PASS |

The page-mapping gate used reviewed full-page anchor phrases on PDF pages 76, 116, and 232 because this scan does not expose reliable printed folios. Zero-offset selection was verified before OCR.

## Tool versions

| Tool | Version |
| --- | --- |
| pdfinfo | 26.05.0 |
| pdftotext | 24.02.0 |
| pdftoppm | 26.05.0 |
| OCRmyPDF | 15.2.0+dfsg1 |
| Tesseract | 5.3.4 |

## Gate commands

| Command | Outcome |
| --- | --- |
| `npm run source-pack -- verify --config packages/source-pack/config/documents.v1.json` | PASS; manifest hash matched promoted pack |
| `npm run source-pack -- build --config packages/source-pack/config/documents.v1.json --output private/source-pack.sqlite` | PASS; atomic promotion completed |
| `npm run source-pack -- test-fixtures --database private/source-pack.sqlite` | PASS; 11 / 11 |
| `npm run verify:private` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS; 31 files / 108 tests |
| `npm run build` | PASS |

`git ls-files project_sources private tmp` returned no paths. No source PDF, extracted text, OCR image/output, SQLite database, cache, or source passage is tracked.
