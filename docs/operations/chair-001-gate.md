# CHAIR-001 Gate Evidence

**Date:** 2026-08-28

**Branch:** `chair-001-finalization`

**Runtime:** Node.js 24.19.0, npm 11.9.0

## Automated gate

The build output tree was cleaned before verification so no generated declarations could satisfy workspace imports accidentally.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Exit 0; all four workspaces passed with no emit |
| `npm test` | Exit 0; 13 test files and 53 tests passed |
| `npm run build` | Exit 0; all four workspaces emitted through project-reference build configs |
| `npm run verify:private` | Exit 0; no forbidden tracked paths were reported |

Generated JavaScript, declarations, source maps, and TypeScript build metadata are confined to ignored `dist/` directories. Previously tracked compiler output beside TypeScript source was removed.

## Direct HTTP and MCP smoke

A fake-mode server was started against a temporary campaign database outside the repository. The official MCP SDK client exercised separate stateless HTTP POST requests through this lifecycle:

1. `initialize`
2. `notifications/initialized`
3. `tools/list`
4. `tools/call` for `get_table_view`

Observed results:

- `GET /health` returned HTTP 200 with status `ok`, schema version 1, database readiness true, and fake-model mode true.
- `tools/list` returned exactly `advance_game` and `get_table_view`.
- `get_table_view` returned the expected player-safe demo campaign projection without an MCP error.

No private source material, credentials, raw campaign state, or hidden Director data is recorded here.
