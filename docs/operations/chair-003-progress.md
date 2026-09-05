# CHAIR-003 implementation checkpoint

Checkpoint date: 2026-09-05

Branch: `chair-003-live-runtime`

This is an in-progress recovery checkpoint, not the CHAIR-003 gate. Do not tag it as complete.

## Completed

- Task 1 — bounded Agents SDK runtime configuration and safe runner seam.
- Task 2 — bounded Director/Narrator contexts, deterministic pruning, exact persisted-plan/result preservation, and spoiler-safe projection.
- Task 3 — four strict private Director retrieval tools with no MCP exposure.
- Task 4 — structured Director prompt/adapter with deterministic seat, resolution, NPC-cause, resource, equipment, and inventory-collision authority checks.
- Task 5 — strict `lock_and_resolve_checks`, immutable stakes, deterministic dice reuse, PLANNED/RESOLVED restart, and true no-roll turns.
- Task 6 — one-shot proposal repair with sanitized diagnostics and no second roll path.
- Task 7 — separate tool-less Narrator, visible-only bounded input, deterministic narration checks, identical-candidate retry, and Bill-owned terse-recovery flow.

Task 4's final verified local commit is `bc2e9d452457468c252ebfa361a4b8d7479e5302`. Its exact code tree is `28719e7a3d37d14b0aeba7e66062281780ade73f`; the connector-created GitHub snapshot commit pointing to that tree is `374b817af966b1a84d36a1c8afdaa73a5d469309`.

Focused Task 4 verification passed: 68 Director tests, all six workspace typechecks, 3 compatibility tests, and `git diff --check`. The final scoped re-review was clean.

## Current gate point

Task 8's server wiring, four-case evaluator, and offline gate are complete. The final real-model run is pending because this workspace intentionally has no `OPENAI_API_KEY`. Do not tag CHAIR-003 complete until `npm run eval` passes on Bill's locally configured machine and the redacted results are recorded.

## Lean private-runtime gate

Bill and Raven revised the execution policy after Task 4. This is a private two-player runtime, not a hostile multi-tenant service. Finish the playable vertical slice before adding broader hardening.

- Implement directly without a task-by-task subagent/reviewer carousel.
- Keep narrow test-first coverage for player agency, immutable stakes/dice, no mutation on failure, visible-only narration, private-source boundaries, and restart recovery.
- Do not add combinatorial adversarial matrices, fuzzing, or equivalent permutations unless an observed failure requires them.
- Replace the original twelve-case live-model gate with four acceptance paths: safe no-roll action, meaningful locked check, narration failure after a roll, and process restart after persisted dice.
- Run one whole-branch review and the full offline verification suite after the vertical slice works.
- Record this as an explicit private-runtime scope amendment; do not claim the original production-hardening gate was executed unchanged.

SQLite, deterministic resolution, validation, projection, and commit remain the only authorities. The final annotated tag and private package follow the successful real-model gate.

## Boundaries still in force

- Tasks 1–7 are offline and require no API key.
- Never inspect, display, persist, or commit API credentials.
- Never commit the private source database, extracted sources, PDFs, prompts containing source passages, or raw model histories.
- The Narrator receives no hidden WorldState and has zero tools.
- The Director cannot invent player intent, roll dice itself, alter locked plans, or write SQLite.
- Retries, repair, narration failure, and restart never reroll.
- Normal play tracing stays disabled.
- CHAIR-001, CHAIR-002, and `main` remain untouched.

Two non-blocking Task 2 review notes remain for final whole-branch review: diagnostic byte maps currently admit arbitrary keys, and serialization failures report zero bytes. They were deliberately deferred rather than expanded into Task 2's blocking fix loop.
