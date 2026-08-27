# CHAIR-001 truth-core finish

Implemented: canonical JSON/SHA-256 hashing; 32-byte HMAC rejection-sampled dice; typed `ResolutionPlan` and `CheckResolution`; the full V1 operation union and Sacred No validation; code-owned decision/finalization metadata; resumable turn ports with deterministic fakes; validated storage stage types; player-only projections; and SDK Streamable HTTP MCP tools (`get_table_view`, `advance_game`) with annotated descriptors.

Retained release-blocking tests cover exact dice vectors, advantage/disadvantage counter use and byte stability; wrong-tier/resource/player-authority Sacred No rejection with immutable source state; complete BOTH exploration commit with fake Director metadata ignored and retry idempotency; and tool descriptors. The intentionally redundant planned per-stage/restart test files were not added because the existing Task 4 repository suite already covers reservations/restart behavior.

Gate commands run: focused engine/server tests, `npm test`, `npm run typecheck`, `npm run build`, and `npm run verify:private`.

Commit hash: `515b1d2fe9c8b20748922dcaf8c700cff79f05d1` (amended below to include this recorded hash). No OpenAI dependency or API call is present. Remaining issue: the local terminal runner emitted npm proxy warnings but did not expose its normal per-test summary; all invoked commands completed without reported failure.
