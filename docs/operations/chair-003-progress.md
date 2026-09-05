# CHAIR-003 implementation checkpoint

Checkpoint date: 2026-09-05

Branch: `chair-003-live-runtime`

This is an in-progress recovery checkpoint, not the CHAIR-003 gate. Do not tag it as complete.

## Completed and independently reviewed

- Task 1 — bounded Agents SDK runtime configuration and safe runner seam.
- Task 2 — bounded Director/Narrator contexts, deterministic pruning, exact persisted-plan/result preservation, and spoiler-safe projection.
- Task 3 — four strict private Director retrieval tools with no MCP exposure.
- Task 4 — structured Director prompt/adapter with deterministic seat, resolution, NPC-cause, resource, equipment, and inventory-collision authority checks.

Task 4's final verified local commit is `bc2e9d452457468c252ebfa361a4b8d7479e5302`. Its exact code tree is `28719e7a3d37d14b0aeba7e66062281780ade73f`; the connector-created GitHub snapshot commit pointing to that tree is `374b817af966b1a84d36a1c8afdaa73a5d469309`.

Focused Task 4 verification passed: 68 Director tests, all six workspace typechecks, 3 compatibility tests, and `git diff --check`. The final scoped re-review was clean.

## Resume point

Resume with Task 5, **Make Stakes and Dice an Idempotent Director Tool**, from the current branch head. Do not begin CHAIR-004.

Task 5 must add `lock_and_resolve_checks`, preserve an immutable single logical plan, resume safely from PLANNED or RESOLVED, reuse stored results on identical retries, reject changed plans, and support no-roll turns without inventing a die. SQLite, deterministic resolution, validation, projection, and commit remain the only authorities.

Then complete Tasks 6–8 in order:

1. One-shot Director repair and candidate validation, with no rerolls.
2. Tool-less Narrator, spoiler guard, identical-input narration retry, and explicit deterministic recovery.
3. Offline full gates, real-model evals, live server/restart verification, redacted gate evidence, final annotated tag, push, and private package.

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
