# CHAIR-005 Save Point After Task 2

Use this note to resume The Third Chair after a context or workspace reset.

## Authoritative repository state

- Repository: `Tracaine/The-Third-Chair`
- Working branch: `chair-005-campaign-beta`
- Base gate: annotated tag `chair-004-gate`
- Base gate target: `5949c68bf22aade5d81e83df38cce59c6b04010c`
- Task-1 donor source: `f98e3bcfb1ff3b56c8ed8d933bb80d63b647552c`
- Task-1 integration commit on this branch: `f49ca8e75afdff978f8cfd72667c8426a36d6263`
- Task-2 implementation commit: `493a7505611a66173328d82f8b2df172bea1c80e`
- Task-2 tree: `7221aa091ac094c742e708d30f10448989263fc0`

Task 1 and Task 2 are complete. Do not recreate, redesign, or polish them unless later integration exposes a concrete defect. Do not create the CHAIR-005 gate tag yet.

## Implemented in Task 2

- Strict campaign-creation and hidden-spine contracts.
- Structured `character_options.option_json` to Task-1 `CharacterCatalog` adapter.
- Separate bounded campaign-spine agent using the existing Director model profile.
- Exactly three route methods: `SOCIAL_LEVERAGE`, `INVESTIGATION_DISCOVERY`, and `FACTION_OR_TRAVEL`.
- Audience, origin, citation, six-segment clock, outcome, and starting-clue validation.
- Deterministic `CharacterBuild` to runtime `ActorState` mapping.
- Initial `WorldState`, root branch, RNG seed, visible opening journal event, and `DecisionRequest(owner: "BOTH")`.
- Migration `002-creation.sql` and idempotent creation-request tracking.
- Atomic campaign/branch/state/request commit with failure leaving no partial campaign.
- Player-safe `create_campaign` MCP registration and Raven-compatible `playerViewId`.

## Verification evidence

The final Task-2 tree passed:

- 11 focused test files;
- 31 focused tests;
- every workspace TypeScript check;
- eval TypeScript checking;
- no real model/API calls.

The working tree was clean and the local and remote branch trees were identical after publication.

## Important assumption

The private source pack must supply reviewed Task-1-compatible structured rows in `character_options`. The repository adapter consumes only `option_json` and source-reference IDs; it never parses or copies source prose during campaign creation. An empty option table correctly prevents character construction instead of manufacturing choices.

## Resume boundary

Resume with CHAIR-005 Task 3 only: checkpoints, immutable `Campaign Start` backfill, automatic checkpoint policy, branch-preserving rewind, replay/RNG preservation, and the two checkpoint MCP tools.

Before work, fetch refs, check out `chair-005-campaign-beta`, confirm the Task-2 commit is an ancestor, and inspect the current working tree rather than overwriting it. Preserve Bill's unrelated local stash named `preserve interrupted CHAIR-004 Codex edits`. Do not begin Tasks 4-8 in the Task-3 slice.

The next planned migration filename is `003-beta.sql`; inspect the live migration sequence again before creating it.
