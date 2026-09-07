# CHAIR-005 Save Point After Task 3

Use this note to resume The Third Chair after a context or workspace reset.

## Authoritative repository state

- Repository: `Tracaine/The-Third-Chair`
- Working branch: `chair-005-campaign-beta`
- Base gate target: `5949c68bf22aade5d81e83df38cce59c6b04010c`
- Task-1 integration commit: `f49ca8e75afdff978f8cfd72667c8426a36d6263`
- Task-2 implementation commit: `493a7505611a66173328d82f8b2df172bea1c80e`
- Task-3 implementation commit: `6c888db7d71d706254dec7cb6f193eb828f8baee`
- Task-3 tree: `f248c0d8f039f54a32ad14643576cfaa81a8384c`

Tasks 1 through 3 are complete. Do not recreate or polish them unless later integration exposes a concrete defect. Do not create the CHAIR-005 gate tag yet.

## Implemented in Task 3

- Migration `003-beta.sql` with checkpoints plus the planned journal/export tables.
- Immutable `Campaign Start` snapshots created atomically with new campaigns.
- Verified legacy backfill from the earliest committed snapshot; a bad canonical hash aborts and restores the pre-migration database.
- Idempotent named checkpoints and duplicate-label conflict protection.
- Typed automatic triggers for death risk, irreversible allegiance, permanent rare-resource spend, major branch closure, and level advancement.
- Deterministic level-difference detection even if the Director omits the advancement tag.
- Automatic before-state checkpoint insertion inside the existing final turn transaction, including Narrator recovery.
- Explicit `REWIND` ledger turns, abandoned-branch preservation, monotonic successor versions, restored checkpoint RNG counters, and deterministic replay.
- Player-safe `create_checkpoint` and explicitly confirmed `rewind_to_checkpoint` MCP tools with the required annotations.

## Verification evidence

The final Task-3 implementation tree passed:

- 10 affected-surface test files;
- 40 focused tests;
- all six workspace TypeScript checks;
- eval TypeScript checking;
- no real model/API calls.

## Important integration note

Fresh fake-mode demo campaigns now use canonical state hashes. A database created by the older fake demo may contain the legacy placeholder `demo-state-0`; migration correctly refuses to bless that as an immutable checkpoint. Preserve such a database for inspection or recreate only the disposable fake demo database. Never rewrite a real campaign hash to bypass validation.

## Resume boundary

Resume with CHAIR-005 Task 4 only: spoiler-safe journal derivation, deterministic session summaries, journal MCP exposure required by the plan, and focused journal tests. Do not begin SaveSets, widget lifecycle controls, Docker, or the beta gate in that slice.

Before work, fetch refs, check out `chair-005-campaign-beta`, confirm the Task-3 commit is an ancestor, and inspect the working tree rather than overwriting it. Preserve Bill's unrelated local stash named `preserve interrupted CHAIR-004 Codex edits`.
