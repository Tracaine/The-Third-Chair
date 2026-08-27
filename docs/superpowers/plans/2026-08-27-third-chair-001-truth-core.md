# CHAIR-001 Truth Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tool-only MCP vertical slice in which fake model adapters resolve one exploration decision while deterministic code preserves player ownership, secrecy, immutable stakes and dice, idempotency, atomic commit, rollback, and restart.

**Architecture:** Build Zod-first shared contracts, a SQLite repository, deterministic HMAC dice, audience projections, a Sacred No operation validator, and a resumable turn orchestrator. Fake Director and Narrator adapters exercise the exact ports later used by the Agents SDK, so no truth-core code changes are required when live models arrive.

**Tech Stack:** Node.js 24 LTS, TypeScript, npm workspaces, Zod 4, Vitest, `node:sqlite`, Express, and `@modelcontextprotocol/sdk`.

**Spec:** `docs/superpowers/specs/2026-08-27-third-chair-design.md`

## Global Constraints

- Apply INV-001 through INV-010 from the spec as release-blocking invariants.
- Store current `WorldState` as validated canonical JSON plus its SHA-256 hash.
- Never hold a SQLite transaction open while invoking a Director or Narrator port.
- Every mutating request supplies `campaignId`, `expectedStateVersion`, `decisionId`, and `clientRequestId`.
- `beginTurn()` acquires a SQLite-backed active-successor reservation. Only one nonterminal successor may own a campaign's current committed state and decision, even across distinct request IDs, processes, and restart.
- Only the resolver creates dice; retries reuse persisted resolutions.
- Only validated `WorldOperation` values can change candidate state.
- Immediately before commit, deterministic code stamps and verifies committed state version, `WorldState` metadata, next-decision version, applicable turn number, and persisted RNG counter.
- The foundational migration runner creates and validates a pre-migration backup before every pending file-database migration and restores it on failure.
- Projection selects allowed records before serialization and never redacts serialized text.
- CHAIR-001 contains no OpenAI dependency, API calls, PDF reads, OCR, React, or commercial source data.

---

### Task 1: Bootstrap the Private TypeScript Workspace

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `scripts/verify-private-boundary.mjs`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/workspace.test.ts`
- Create: `packages/storage/package.json`
- Create: `packages/storage/tsconfig.json`
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`

**Interfaces:**
- Consumes: approved spec at `docs/superpowers/specs/2026-08-27-third-chair-design.md`.
- Produces: npm workspaces named `@third-chair/contracts`, `@third-chair/storage`, `@third-chair/engine`, and `@third-chair/server`; root commands `build`, `typecheck`, `test`, and `verify:private`.

- [ ] **Step 1: Write the privacy fence before initializing git**

Create the exact `.gitignore` block from the portfolio plan. Create `scripts/verify-private-boundary.mjs` with a failing check first: it reads `git ls-files -z`, rejects tracked paths matching `project_sources/`, `private/`, `data/`, `tmp/`, `*.pdf`, `*.sqlite*`, `*.ocr.pdf`, or `*.sidecar.txt`, and exits non-zero with the offending relative paths.

```js
import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const forbidden = tracked.filter((path) =>
  /^(project_sources|private|data|tmp)\//.test(path) ||
  /(?:\.pdf|\.sqlite(?:-shm|-wal)?|\.ocr\.pdf|\.sidecar\.txt)$/i.test(path),
);
if (forbidden.length > 0) {
  process.stderr.write(`Forbidden tracked files:\n${forbidden.join("\n")}\n`);
  process.exit(1);
}
```

- [ ] **Step 2: Add the root workspace files and failing smoke test**

Use the root `package.json` from the portfolio. Add TypeScript, Vitest, `tsx`, `@types/node`, and Zod 4 as development dependencies. The first test imports `SCHEMA_VERSION` from `@third-chair/contracts` and expects `1`; leave the export absent.

```ts
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@third-chair/contracts";

describe("workspace", () => {
  it("loads the contracts workspace through its package export", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
```

- [ ] **Step 3: Install and run the test to verify RED**

Run: `npm install && npm test -- packages/contracts/test/workspace.test.ts`

Expected: FAIL because `SCHEMA_VERSION` is not exported.

- [ ] **Step 4: Add the minimum export and verify GREEN**

```ts
// packages/contracts/src/index.ts
export const SCHEMA_VERSION = 1 as const;
```

Run: `npm test -- packages/contracts/test/workspace.test.ts && npm run typecheck && npm run verify:private`

Expected: all commands PASS and no private/source paths appear in tracked files.

- [ ] **Step 5: Initialize and commit**

Run:

```bash
git init
git add .gitignore .env.example package.json package-lock.json tsconfig.base.json vitest.workspace.ts scripts packages apps docs
git commit -m "chore: bootstrap third chair workspace"
```

Before committing, run `git status --short` and confirm no file under `project_sources/`, `private/`, `data/`, or `tmp/` is staged.

---

### Task 2: Define IDs, Player Intents, Decisions, and World State

**Files:**
- Create: `packages/contracts/src/ids.ts`
- Create: `packages/contracts/src/intents.ts`
- Create: `packages/contracts/src/decisions.ts`
- Create: `packages/contracts/src/world-state.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/world-state.test.ts`
- Test: `packages/contracts/test/decision-ownership.test.ts`

**Interfaces:**
- Consumes: `SCHEMA_VERSION: 1`.
- Produces: `IdSchemas`, `ActorIntentSchema`, `DecisionRequestSchema`, `IntentAdvanceGameCommandSchema`, CHAIR-001 alias `AdvanceGameCommandSchema`, `WorldStateSchema`, `WorldState`, `requiredSeats(decision)`, and `validateIntentsForDecision(decision, intents, currentState)`.

- [ ] **Step 1: Write failing schema and ownership tests**

Cover these exact cases:

```ts
it("rejects a BOTH decision with only Bill's intent", () => {
  expect(() => validateIntentsForDecision(bothDecision, [billIntent], minimumWorldState)).toThrow(
    "Decision requires intents from BILL and RAVEN",
  );
});

it("rejects a server-authored player intent", () => {
  expect(() => ActorIntentSchema.parse({ ...billIntent, seat: "DIRECTOR" })).toThrow();
});

it("rejects a Raven intent for Bill's actor", () => {
  expect(() => validateIntentsForDecision(
    ravenDecision,
    [{ ...ravenIntent, actorId: "actor_bill" }],
    minimumWorldState,
  ))
    .toThrow("Actor actor_bill is controlled by BILL");
});

it("round-trips the minimum valid world state", () => {
  expect(WorldStateSchema.parse(minimumWorldState)).toEqual(minimumWorldState);
});

it("requires the ordinary advance command discriminant", () => {
  expect(IntentAdvanceGameCommandSchema.parse({
    kind: "INTENTS",
    campaignId,
    expectedStateVersion: 0,
    decisionId,
    clientRequestId,
    intents: [billIntent, ravenIntent],
  }).kind).toBe("INTENTS");
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run: `npm test -- packages/contracts/test/world-state.test.ts packages/contracts/test/decision-ownership.test.ts`

Expected: FAIL because the schemas and functions do not exist.

- [ ] **Step 3: Implement exact primitive contracts**

Use UUID-shaped non-empty strings for persisted IDs, but allow deterministic fixture IDs beginning `test_`.

```ts
export const PersistedIdSchema = z.string().refine(
  (value) => /^test_[a-z0-9_]+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value),
  "Expected UUID or test fixture ID",
);
export const SeatSchema = z.enum(["BILL", "RAVEN", "DIRECTOR"]);
export const AudienceSchema = z.enum(["PUBLIC", "PARTY", "BILL", "RAVEN", "DIRECTOR"]);
export const DecisionOwnerSchema = z.enum(["BILL", "RAVEN", "BOTH", "DIRECTOR"]);
```

`ActorIntentSchema` must contain `seat`, `actorId`, `mode`, `declaredAction`, `desiredOutcome`, `approach`, `committedResourceIds`, `targetIds`, and `contingency`. Trim strings, cap free text at 2,000 characters, default both ID arrays to empty, and require `declaredAction` for `ACT`.

`DecisionRequestSchema` must contain `id`, `stateVersion`, `mode`, `owner`, `eligibleActorIds`, `situation`, `constraints`, `requiredInput`, and `legalOptions`. Cap each visible string at 2,000 characters and legal options at twelve.

`IntentAdvanceGameCommandSchema` is the V1 ordinary-play command with literal `kind: "INTENTS"`, campaign ID, expected state version, decision ID, client request ID, and intents. In CHAIR-001 export `AdvanceGameCommandSchema = IntentAdvanceGameCommandSchema` so the engine and MCP surface consume the stable owning-contract name. CHAIR-003 replaces that alias with a discriminated union containing the explicit narration-recovery variant; it does not add another public MCP tool.

Every Task 2 `z.object()` schema is strict, including commands, decisions, intents, scoped records, and all nested persisted records. Unknown fields are rejected at the truth boundary rather than silently stripped.

- [ ] **Step 4: Implement the minimum complete `WorldState` schema**

The schema owns these exact top-level keys; every potentially hidden fact is a `ScopedRecord` with an audience.

```ts
export const WorldStateSchema = z.object({
  metadata: z.object({
    schemaVersion: z.literal(1),
    campaignId: PersistedIdSchema,
    turnNumber: z.number().int().nonnegative(),
    stateVersion: z.number().int().nonnegative(),
    worldDate: z.object({ yearDr: z.number().int(), month: z.string(), day: z.number().int().positive() }),
    currentLocationId: PersistedIdSchema,
    sceneId: PersistedIdSchema,
    rngCounter: z.number().int().nonnegative(),
  }),
  table: z.object({
    rulesEdition: z.literal("SRD_5_1"),
    settingDateDr: z.literal(1375),
    diceMode: z.literal("SERVER_OPEN"),
    deathMode: z.enum(["STANDARD", "HEROIC"]),
    houseRules: z.array(z.object({ id: PersistedIdSchema, title: z.string(), text: z.string(), acceptedAtTurn: z.number().int() })),
  }),
  actors: z.record(PersistedIdSchema, ActorStateSchema),
  inventory: z.record(PersistedIdSchema, InventoryItemSchema),
  combat: CombatStateSchema.nullable(),
  locations: z.record(PersistedIdSchema, LocationStateSchema),
  npcs: z.record(PersistedIdSchema, NpcStateSchema),
  factions: z.record(PersistedIdSchema, FactionStateSchema),
  quests: z.record(PersistedIdSchema, QuestStateSchema),
  facts: z.array(ScopedFactSchema),
  events: z.array(ScopedEventSchema),
  clocks: z.record(PersistedIdSchema, ClockStateSchema),
  flags: z.array(ScopedFlagSchema),
  currentDecision: DecisionRequestSchema,
});
```

Define `ActorStateSchema` with controller, name, level, class/ancestry/background source keys, abilities, proficiency bonus, AC, max/current/temporary HP, speed, conditions, death saves, resources, spells, equipment IDs, public notes, and audience-scoped notes. `LocationStateSchema`, `NpcStateSchema`, `FactionStateSchema`, `QuestStateSchema`, and `ClockStateSchema` each carry a record-level `audience` in addition to IDs, bounded names/statuses, and audience-scoped fact arrays, so projection can exclude an undiscovered entity before serialization. Do not add unscoped `secret`, `notes`, `plan`, or `intent` string fields.

- [ ] **Step 5: Implement decision validation and verify GREEN**

`requiredSeats()` maps `BILL` to `{"BILL"}`, `RAVEN` to `{"RAVEN"}`, `BOTH` to both seats, and `DIRECTOR` to an empty set. `validateIntentsForDecision(decision, intents, currentState)` rejects duplicate seats, missing required seats, extra seats, ineligible actors, mismatched controllers, and any `ACT` that commits a resource ID the actor does not own. Controller and resource ownership are read from the supplied authoritative `WorldState`; they are never inferred from actor IDs or duplicated into the player-visible decision request.

Tests exercise every listed rejection, default intent ID arrays, the 2,000-character and twelve-option bounds, nested and command unknown-key rejection, and the public `AdvanceGameCommandSchema` alias. Ownership tests use a fully valid parsed `WorldState` fixture rather than a partial type assertion.

Run: `npm test -- packages/contracts/test/world-state.test.ts packages/contracts/test/decision-ownership.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts
git commit -m "feat: define campaign truth contracts"
```

---

### Task 3: Build Audience Projections and Sentinel Leak Tests

**Files:**
- Create: `packages/contracts/src/views.ts`
- Create: `packages/engine/src/projection/audience.ts`
- Create: `packages/engine/src/projection/player-view.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/projection/player-view.test.ts`
- Test: `packages/engine/test/projection/sentinel-leaks.test.ts`

**Interfaces:**
- Consumes: `WorldState`, `Audience`, and `DecisionRequest`.
- Produces: `PlayerViewSchema`, `PlayerView`, `allowedAudiences(viewer)`, `projectPlayerView(state, viewer)`, and `assertNoForbiddenSentinels(value, sentinels)`.

- [ ] **Step 1: Write failing projection tests with unique sentinels**

Build a state fixture containing `SENTINEL_DIRECTOR_CLOCK`, `SENTINEL_RAVEN_MEMORY`, and `SENTINEL_BILL_MEMORY` in distinct scoped records.

```ts
expect(JSON.stringify(projectPlayerView(state, "BILL"))).not.toContain("SENTINEL_DIRECTOR_CLOCK");
expect(JSON.stringify(projectPlayerView(state, "BILL"))).not.toContain("SENTINEL_RAVEN_MEMORY");
expect(JSON.stringify(projectPlayerView(state, "RAVEN"))).not.toContain("SENTINEL_BILL_MEMORY");
expect(JSON.stringify(projectPlayerView(state, "RAVEN"))).toContain("SENTINEL_RAVEN_MEMORY");
```

Also assert that a Bill-owned decision projected to Raven says Bill owns the next decision but omits Bill-only constraints.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/engine/test/projection`

Expected: FAIL because projection functions do not exist.

- [ ] **Step 3: Implement selection-first projection**

```ts
export function allowedAudiences(viewer: PlayerAudience): ReadonlySet<Audience> {
  return new Set(["PUBLIC", "PARTY", viewer]);
}

function visible<T extends { audience: Audience }>(records: readonly T[], viewer: PlayerAudience): T[] {
  const allowed = allowedAudiences(viewer);
  return records.filter((record) => allowed.has(record.audience));
}
```

Construct a new `PlayerView` field by field. It contains campaign ID, state version, visible date/location/scene, public actor sheets, the viewer's own full permitted actor resources, known NPCs, visible clues/facts/events/exits/clocks, visible combat, open threads, current decision, and recovery status. Do not clone `WorldState` and delete keys.

The nested player decision view always exposes `id`, `stateVersion`, `mode`, `owner`, and `situation`. It exposes `eligibleActorIds`, `constraints`, `requiredInput`, and `legalOptions` only when the request owner is the viewer or `BOTH`; this is how Raven can see that Bill owns the next decision without receiving Bill-only decision instructions, and vice versa. In CHAIR-001, `recoveryStatus` is the literal `"NONE"`; CHAIR-003 deliberately widens that field when narration recovery is implemented.

Inventory projection fails closed: include only items whose non-null `ownerActorId` names an actor controlled by the viewer. V1 has no shared/unowned-item audience contract, so null-owner items remain private; a projected item's `containerId` is retained only when that container is also in the selected item set, otherwise it becomes `null`. Visible combat includes filtered initiative IDs and `currentActorId`; the latter is the source ID only when it is in the selected visible-combat set and is otherwise `null`.

- [ ] **Step 4: Add a structural secret-field guard**

Traverse the produced `PlayerView` and reject keys named `secret`, `hidden`, `director`, `adventureSpine`, `rngSeed`, or `rawSourceText`. Keep sentinel matching in tests so renamed keys cannot bypass coverage.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/engine/test/projection && npm run typecheck`

Expected: PASS with zero sentinel occurrences for forbidden viewers.

```bash
git add packages/contracts packages/engine
git commit -m "feat: project spoiler-safe player views"
```

---

### Task 4: Create SQLite Migrations and Atomic Repositories

**Files:**
- Create: `packages/storage/migrations/001-core.sql`
- Create: `packages/storage/src/database.ts`
- Create: `packages/storage/src/migrations.ts`
- Create: `packages/storage/src/backup.ts`
- Create: `packages/storage/src/types.ts`
- Create: `packages/storage/src/campaign-repository.ts`
- Create: `packages/storage/src/turn-repository.ts`
- Create: `packages/storage/src/index.ts`
- Test: `packages/storage/test/migrations.test.ts`
- Test: `packages/storage/test/backup.test.ts`
- Test: `packages/storage/test/turn-repository.test.ts`
- Test: `packages/storage/test/restart.test.ts`

**Interfaces:**
- Consumes: `WorldState`, `DecisionRequest`, and `ActorIntent`.
- Produces: `openCampaignDatabase(path)`, `runMigrationsWithBackup(path)`, `createPreMigrationBackup(path)`, `restorePreMigrationBackup(path, backup)`, `TurnStatus`, `JsonValue`, `CampaignRepository`, `TurnRepository`, `BeginTurnResult`, and `CommitTurnInput`.

**Forward-contract boundary:** Task 4 defines the storage ledger and its `TurnStatus`, IDs, inputs, results, and records in `packages/storage/src/types.ts`. `ResolutionPlan`, `CheckResolution`, and `TurnProposal` become Zod-first contracts only in Tasks 5 and 6; until then, the corresponding repository stage methods accept immutable `JsonValue` payloads and persist them without interpretation. They never apply those payloads to campaign reality. Tasks 5 and 6 narrow these method signatures to their validated contract types without a schema migration. `persistResolutions()` stores the payload together with the resolved next RNG counter so `commitTurn()` can verify candidate metadata before Task 5's typed resolver exists.

- [ ] **Step 1: Write failing migration and compare-and-set tests**

Tests must prove WAL and foreign keys are enabled for file databases; migrations run once; every pending file migration first creates a validated backup and a failing migration restores the original bytes/data; request IDs are unique per campaign; state version conflicts do not insert turns; and a second database instance can discover and resume `PROCESSING`, `PLANNED`, `RESOLVED`, and relevant `AWAITING_INPUT` turns.

Use two independently opened database connections to race different valid request IDs against the same state version and decision. Exactly one returns `STARTED`; the other returns `ACTIVE_SUCCESSOR` naming the same reserved turn and creates no sibling plan, resolution, or RNG consumption. Reopen the database and prove the same active successor is discovered.

```ts
expect(repo.beginTurn(validBegin).kind).toBe("STARTED");
expect(repo.beginTurn(validBegin)).toMatchObject({ kind: "EXISTING" });
expect(() => repo.beginTurn({ ...validBegin, inputHash: "different" }))
  .toThrow("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT");
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/storage/test`

Expected: FAIL because the migration and repositories do not exist.

- [ ] **Step 3: Implement `001-core.sql`**

Create these exact tables and indexes:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_pack_hash TEXT NOT NULL,
  rng_seed BLOB NOT NULL CHECK(length(rng_seed) = 32),
  state_version INTEGER NOT NULL CHECK(state_version >= 0),
  current_state_json TEXT NOT NULL,
  current_state_hash TEXT NOT NULL,
  current_decision_json TEXT NOT NULL,
  active_branch_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','READ_ONLY','ARCHIVED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  parent_branch_id TEXT REFERENCES branches(id),
  fork_turn_id TEXT,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','ABANDONED')),
  created_at TEXT NOT NULL
);

CREATE TABLE turns (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  client_request_id TEXT NOT NULL,
  expected_state_version INTEGER NOT NULL,
  decision_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROCESSING','PLANNED','RESOLVED','AWAITING_INPUT','COMMITTED','FAILED')),
  before_state_json TEXT NOT NULL,
  before_state_hash TEXT NOT NULL,
  locked_intents_json TEXT NOT NULL,
  model_profile_json TEXT,
  resolution_plan_json TEXT,
  resolutions_json TEXT,
  director_proposal_json TEXT,
  candidate_state_json TEXT,
  narration_json TEXT,
  next_decision_json TEXT,
  error_json TEXT,
  committed_state_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, client_request_id)
);

CREATE TABLE active_turns (
  campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),
  turn_id TEXT NOT NULL UNIQUE REFERENCES turns(id),
  reserved_state_version INTEGER NOT NULL,
  reserved_decision_id TEXT NOT NULL,
  reserved_at TEXT NOT NULL
);

CREATE TABLE turn_recovery_commands (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  turn_id TEXT NOT NULL REFERENCES turns(id),
  client_request_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  expected_state_version INTEGER NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROCESSING','COMMITTED','FAILED')),
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, client_request_id),
  UNIQUE(turn_id, decision_id)
);

CREATE TABLE turn_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  turn_id TEXT NOT NULL REFERENCES turns(id),
  status TEXT NOT NULL,
  payload_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX turns_campaign_status_idx ON turns(campaign_id, status);
CREATE INDEX turn_events_turn_idx ON turn_events(turn_id, sequence);
CREATE INDEX recovery_commands_turn_idx ON turn_recovery_commands(turn_id);
```

Insert the root branch and campaign in one transaction. Defer the foreign key from `campaigns.active_branch_id` because SQLite cannot add it cleanly during the initial mutual insert; repository validation must ensure it names a branch in the same campaign. `active_turns.campaign_id` is the SQLite-enforced one-successor reservation. `turn_recovery_commands` is foundational V1 storage for the CHAIR-003 `advance_game` recovery variant, not a public tool.

- [ ] **Step 4: Implement repository transitions**

```ts
export interface TurnRepository {
  beginTurn(input: BeginTurnInput): BeginTurnResult;
  persistPlan(turnId: TurnId, plan: JsonValue): void;
  persistResolutions(turnId: TurnId, resolutions: readonly JsonValue[], rngCounter: number): void;
  persistProposal(turnId: TurnId, proposal: JsonValue, candidate: WorldState): void;
  commitTurn(input: CommitTurnInput): CommittedTurn;
  markAwaitingInput(turnId: TurnId, decision: DecisionRequest): void;
  markFailed(turnId: TurnId, failure: TurnFailure): void;
  abandonTurn(turnId: TurnId, failure: TurnFailure): void;
  getTurn(turnId: TurnId): TurnRecord;
  findByRequest(campaignId: CampaignId, clientRequestId: ClientRequestId): TurnRecord | null;
}
```

`beginTurn()` uses `BEGIN IMMEDIATE`. It checks `active_turns` before inserting: an identical request/input resumes; a reused request ID with different input fails; a different request ID returns `ACTIVE_SUCCESSOR`; otherwise it inserts the turn and reservation in the same transaction. The in-process mutex never substitutes for this repository rule.

`commitTurn()` uses `BEGIN IMMEDIATE`, reparses both state blobs with `WorldStateSchema`, verifies before-state hash, current campaign version, active reservation ownership, finalized state/version/decision/RNG metadata, updates `campaigns`, marks the turn `COMMITTED`, inserts the status event, deletes the active reservation, and commits. On any error it rolls back. `markFailed()` records a resumable failure and retains the reservation. `abandonTurn()` records a terminal failure and clears the reservation atomically without changing campaign reality.

`runMigrationsWithBackup(path)` owns migration safety from this first schema onward. Before applying any pending migration to an existing file database it checkpoints/truncates WAL, creates and validates a timestamped backup, applies migrations, and runs integrity and foreign-key checks. On any failure it closes the failed database, restores the backup, verifies the restored database, and throws. New-database creation uses an atomic staged file. Later CHAIR migrations call this same primitive rather than implementing their own protection.

For deterministic failure tests, `runMigrationsWithBackup(path, options?)` may accept an internal injected ordered migration list; normal callers omit it and load the bundled migrations. The same backup, validation, transaction, restore, and post-restore verification path applies to injected migrations, so the test seam cannot bypass production safety behavior.

- [ ] **Step 5: Prove restart and atomicity, then commit**

Run: `npm test -- packages/storage/test && npm run typecheck`

Expected: PASS. Kill and reopen file-backed test databases between stage writes; persisted plan/resolution records and the active reservation remain readable, campaign state remains unchanged before commit, concurrent distinct request IDs never create siblings, and an injected migration failure restores the pre-migration database.

```bash
git add packages/storage
git commit -m "feat: persist atomic resumable turns"
```

---

### Task 5: Implement Canonical Hashing and Deterministic Dice

**Files:**
- Create: `packages/engine/src/canonical-json.ts`
- Create: `packages/engine/src/hash.ts`
- Create: `packages/engine/src/rng/hmac-rng.ts`
- Create: `packages/engine/src/resolution/dice.ts`
- Create: `packages/contracts/src/resolutions.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/engine/test/rng/hmac-rng.test.ts`
- Test: `packages/engine/test/resolution/dice.test.ts`

**Interfaces:**
- Consumes: 32-byte campaign seed and the state's monotonic `rngCounter`.
- Produces: `canonicalJson(value)`, `sha256Json(value)`, `deterministicDie(input)`, `resolvePlan(seed, campaignId, counter, plan)`, `ResolutionPlanSchema`, and `CheckResolutionSchema`.

- [ ] **Step 1: Write failing fixed-vector and resolution tests**

Use a seed of 32 zero bytes and these vectors for the exact HMAC message format `${campaignId}:${counter}:${dieIndex}:${sides}:${rejection}`:

```ts
expect(deterministicDie(zeroSeed, "camp_test", 0, 0, 20)).toBe(9);
expect(deterministicDie(zeroSeed, "camp_test", 1, 0, 20)).toBe(5);
expect(deterministicDie(zeroSeed, "camp_test", 2, 0, 6)).toBe(6);
expect(deterministicDie(zeroSeed, "camp_test", 3, 1, 6)).toBe(4);
```

Also test advantage keeps the higher d20, disadvantage keeps the lower, the counter advances once for every natural die (including both advantage/disadvantage dice), and the same input returns byte-identical resolutions.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/engine/test/rng packages/engine/test/resolution/dice.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement unbiased HMAC dice**

```ts
const UINT256_RANGE = 1n << 256n;

export function deterministicDie(
  seed: Uint8Array,
  campaignId: string,
  counter: number,
  dieIndex: number,
  sides: number,
): number {
  if (!Number.isSafeInteger(sides) || sides < 2) throw new RangeError("sides must be >= 2");
  const modulus = BigInt(sides);
  const limit = UINT256_RANGE - (UINT256_RANGE % modulus);
  for (let rejection = 0; ; rejection += 1) {
    const message = `${campaignId}:${counter}:${dieIndex}:${sides}:${rejection}`;
    const digest = createHmac("sha256", seed).update(message).digest("hex");
    const sample = BigInt(`0x${digest}`);
    if (sample < limit) return Number(sample % modulus) + 1;
  }
}
```

- [ ] **Step 4: Define locked resolution contracts and resolver**

`ResolutionPlan` contains a plan ID and one or more checks. Each check fixes actor, check kind, ability/skill/save/attack key, dice expression, advantage mode and reason, modifier, DC or opposed modifier, public/secret visibility, success stakes, failure stakes, and permitted outcome tiers. `CheckResolution` stores every natural die, kept die, modifier, total, target, tier, visibility, stakes, citations, starting counter, and ending counter.

No field in `CheckResolution` is optional after resolution. `resolvePlan()` returns `{ resolutions, nextRngCounter }` and never mutates input.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/engine/test/rng packages/engine/test/resolution && npm run typecheck`

```bash
git add packages/contracts packages/engine
git commit -m "feat: add replayable open dice resolver"
```

---

### Task 6: Enforce the Sacred No with Validated World Operations

**Files:**
- Create: `packages/contracts/src/operations.ts`
- Create: `packages/contracts/src/proposals.ts`
- Create: `packages/engine/src/operations/apply.ts`
- Create: `packages/engine/src/operations/validate.ts`
- Create: `packages/engine/src/turn/decision-policy.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/engine/test/operations/sacred-no.test.ts`
- Test: `packages/engine/test/operations/resources.test.ts`
- Test: `packages/engine/test/operations/candidate-state.test.ts`
- Test: `packages/engine/test/turn/combat-ownership.test.ts`

**Interfaces:**
- Consumes: `WorldState`, locked intents, and persisted `CheckResolution[]`.
- Produces: `WorldOperationSchema`, `TurnProposalSchema`, `validateOperation`, and `applyOperationsToClone`.

- [ ] **Step 1: Write failing outcome, resource, and authority tests**

```ts
expect(() => applyOperationsToClone(state, [damageOnSuccess], failedResolutionContext))
  .toThrow("OPERATION_OUTCOME_TIER_MISMATCH");
expect(() => applyOperationsToClone(state, [spendMissingSlot], context))
  .toThrow("RESOURCE_UNDERFLOW");
expect(() => applyOperationsToClone(state, [inventBillDialogue], context))
  .toThrow("PLAYER_AUTHORITY_VIOLATION");
expect(state).toEqual(before); // application always targets a clone
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/engine/test/operations`

Expected: FAIL.

- [ ] **Step 3: Define the discriminated operation union**

Every operation has `id`, `kind`, `cause`, `reason`, and `audience`. `cause` is exactly one of:

```ts
const OperationCauseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("UNCONTESTED"), intentActorId: PersistedIdSchema }),
  z.object({
    type: z.literal("RESOLUTION"),
    resolutionId: PersistedIdSchema,
    allowedOutcomeTiers: z.array(z.enum(["CRITICAL_FAILURE", "FAILURE", "SUCCESS", "CRITICAL_SUCCESS"])).min(1),
  }),
  z.object({ type: z.literal("SYSTEM"), systemRule: z.enum(["INITIATIVE", "TIME", "CHECKPOINT", "REWIND"]) }),
]);
```

The V1 operation kinds are `SET_HP`, `SET_TEMP_HP`, `SPEND_RESOURCE`, `RESTORE_RESOURCE`, `ADD_CONDITION`, `REMOVE_CONDITION`, `MOVE_ACTOR`, `ADD_INVENTORY`, `REMOVE_INVENTORY`, `SET_EQUIPPED`, `SET_COMBAT`, `ADVANCE_INITIATIVE`, `ADD_FACT`, `ADD_EVENT`, `ADVANCE_CLOCK`, `SET_NPC_ATTITUDE`, `SET_QUEST_STATUS`, `SET_FLAG`, and `SET_DECISION`. Each payload uses IDs and bounded numeric deltas; no generic JSON Patch or arbitrary path write exists. `TurnProposalSchema` contains `uncontestedOperations`, `checkLinkedOperations`, `memoryWrites`, `riskTags`, `nextDecision`, and `narrativeBrief`; CHAIR-001 fakes set `riskTags` to an empty array.

- [ ] **Step 4: Implement validation and clone application**

Validation order is fixed: schema, referenced entity existence, controller/intent authority, cause existence, outcome compatibility, audience monotonicity, resource bounds, domain invariant, resulting state parse. Reject player dialogue, inner thought, consent, or extra action as `ADD_EVENT` unless it exactly cites a locked intent from that player.

`applyOperationsToClone()` uses `structuredClone(state)`, applies operations in array order, reparses with `WorldStateSchema`, recomputes derived combat/current actor facts, and returns the candidate plus an operation audit. It never catches and converts invariant failures into partial success.

Implement `deriveDecisionAuthority(candidate, proposedDecision)` as code authority. In combat, the current initiative actor's controller fixes the owner and eligible actor. A reaction/resource decision is owned by the affected actor's controller. Ordinary exploration/social decisions are `BOTH`; a clarification may be one seat only when it cites that seat's locked intent. Reject a proposed owner that differs. A Director-controlled initiative beat must be resolved internally before the engine returns; it can never be relabeled Bill or Raven.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/engine/test/operations packages/engine/test/turn/combat-ownership.test.ts && npm run typecheck`

```bash
git add packages/contracts packages/engine
git commit -m "feat: enforce sacred no operations"
```

---

### Task 7: Build the Resumable Turn Orchestrator with Fake Model Ports

**Files:**
- Create: `packages/engine/src/mutex.ts`
- Create: `packages/engine/src/turn/ports.ts`
- Create: `packages/engine/src/turn/context.ts`
- Create: `packages/engine/src/turn/finalize-candidate.ts`
- Create: `packages/engine/src/turn/turn-engine.ts`
- Create: `packages/engine/src/turn/fakes.ts`
- Create: `packages/engine/src/index.ts`
- Test: `packages/engine/test/turn/exploration-turn.test.ts`
- Test: `packages/engine/test/turn/idempotency.test.ts`
- Test: `packages/engine/test/turn/failure-injection.test.ts`
- Test: `packages/engine/test/turn/restart-resume.test.ts`
- Test: `packages/engine/test/turn/commit-metadata.test.ts`

**Interfaces:**
- Consumes: repository ports, projection, resolution, operation application, `DirectorPort`, and `NarratorPort`.
- Produces: `createTurnEngine(deps): TurnEngine`, `finalizeCandidateForCommit(input)`, `FakeDirector`, `FakeNarrator`, and `FailureInjector`.

- [ ] **Step 1: Write the failing complete-turn test**

The fixture decision owner is `BOTH`. Bill distracts a guard and Raven searches a desk. The fake Director calls `runtime.lockAndResolveChecks()` for Raven's Investigation check, returns one outcome-linked clue operation, and sets the next decision to `BILL`. The fake Narrator describes only visible events.

Assert:

```ts
expect(result.kind).toBe("COMMITTED");
expect(result.turn.lockedIntents).toEqual([billIntent, ravenIntent]);
expect(result.view.stateVersion).toBe(1);
expect(result.view.currentDecision.stateVersion).toBe(1);
expect(result.view.currentDecision.owner).toBe("BILL");
expect(repository.countCommittedTurns(campaignId)).toBe(1);
```

Make the fake Director deliberately return wrong metadata (`stateVersion`, `turnNumber`, `rngCounter`, and next-decision `stateVersion`). Assert deterministic finalization ignores those values. After commit, the campaign row, parsed `WorldState`, returned `PlayerView`, and next `DecisionRequest` all carry committed state version `1`; turn number is advanced once and RNG counter equals the persisted resolved counter.

- [ ] **Step 2: Write failing idempotency, failure, and restart tests**

Run the same command twice concurrently and expect one Director call, one Narrator call, one roll set, and one committed version. Also race two different request IDs with identical expected version/decision through separate repository connections; exactly one may become the active successor, and the loser must discover it without invoking either model or consuming RNG. Inject failures after `PROCESSING`, `PLANNED`, `RESOLVED`, candidate validation, and narration. Before commit, the campaign state hash and version must remain unchanged. Recreate the engine and repositories from disk, discover/resume the reserved turn, and expect stored plan and dice to be reused. Add a combat fixture in which Director-controlled actors advance internally until Raven owns initiative; assert the engine returns a Raven decision without inventing Raven's action, and a later Bill-owned initiative stops immediately for Bill.

- [ ] **Step 3: Run tests to verify RED**

Run: `npm test -- packages/engine/test/turn`

Expected: FAIL.

- [ ] **Step 4: Implement the orchestrator pipeline**

Use a keyed in-process mutex to reduce duplicate work; the SQLite active-successor reservation and repository compare-and-set are the cross-process authority. The exact pipeline is:

```ts
validate INTENTS command -> lock campaign -> reserve/begin or discover/resume turn -> build DirectorInput
-> DirectorPort.propose(runtime.lockAndResolveChecks) -> validate proposal
-> apply operations to clone -> project before/after views
-> NarratorPort.narrate -> validate narration
-> finalizeCandidateForCommit -> repository.commitTurn
-> project committed PlayerView -> return AdvanceGameResult
```

`lockAndResolveChecks(plan)` persists the plan before rolling, returns existing resolutions when present, otherwise resolves and persists dice plus the next RNG counter. The Director may call it only once with one plan ID; an identical repeat is idempotent and a different repeat fails.

`NarrationSchema` contains `sceneText`, `spokenNpcLines`, `mustIncludeResolutionIds`, `mustIncludeEventIds`, and `visibleEventIds`. It cannot carry operations. The engine verifies every visible resolution and required visible event is represented before commit.

`finalizeCandidateForCommit()` runs after narration validation and immediately before repository commit. It takes the previous committed state/version, validated candidate, proposed next decision, persisted resolved RNG counter, and server-generated commit metadata. It returns a fresh reparsed candidate and decision with `stateVersion = previous + 1`, `WorldState.metadata.stateVersion` equal to that value, the applicable `turnNumber` advanced exactly once, `rngCounter` equal to the persisted next counter, and `DecisionRequest.stateVersion` equal to that same committed version. Director-supplied values for these fields are ignored. `commitTurn()` independently rejects any mismatch.

- [ ] **Step 5: Implement deterministic fake adapters**

Fakes accept functions in their constructors, count calls, and never inspect data outside `DirectorInput` or `NarratorInput`. Provide a terse fake Narrator that renders check blocks before consequence sentences so the MCP slice already uses the correct presentation order.

- [ ] **Step 6: Run all turn tests and commit**

Run: `npm test -- packages/engine/test/turn packages/engine/test/projection packages/engine/test/operations && npm run typecheck`

```bash
git add packages/engine
git commit -m "feat: orchestrate resumable atomic turns"
```

---

### Task 8: Expose the Fake-Model Tool-Only MCP Vertical Slice

**Files:**
- Create: `apps/server/src/config.ts`
- Create: `apps/server/src/http/app.ts`
- Create: `apps/server/src/mcp/result.ts`
- Create: `apps/server/src/mcp/server.ts`
- Create: `apps/server/src/mcp/tools/get-table-view.ts`
- Create: `apps/server/src/mcp/tools/advance-game.ts`
- Create: `apps/server/src/index.ts`
- Test: `apps/server/test/tool-descriptors.test.ts`
- Test: `apps/server/test/mcp-vertical-slice.test.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: `TurnEngine`, campaign repositories, `PlayerViewSchema`, and `AdvanceGameCommandSchema`.
- Produces: Express `/health`, Streamable HTTP `/mcp`, `createMcpServer(deps)`, `get_table_view`, and `advance_game`.

- [ ] **Step 1: Write failing descriptor and handler tests**

Assert both tools advertise input and output schemas. `get_table_view` has `{ readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }`. `advance_game` has `{ readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true }`. Test that neither result contains a Director sentinel in `structuredContent`, `content`, or `_meta`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- apps/server/test`

Expected: FAIL.

- [ ] **Step 3: Implement result partitioning and tools**

`get_table_view` returns the current player projection in `structuredContent`, one short status line in `content`, and presentation-only card ordering in `_meta`. `advance_game` validates input, calls the engine, puts locked intents, visible rolls, narration, current status, and next decision into `structuredContent`, and returns no hidden diagnostics.

Register tools with descriptions beginning `Use this when...`. Do not attach a UI resource in CHAIR-001.

- [ ] **Step 4: Add HTTP wiring and readiness**

`GET /health` returns status, schema version, database readiness, and fake-model mode without paths or secrets. `POST /mcp` uses the SDK Streamable HTTP transport. Bind to `127.0.0.1` by default and use `PORT=8787` when absent.

- [ ] **Step 5: Run the CHAIR-001 gate**

Run:

```bash
npm run verify:private
npm run typecheck
npm test
npm run build
```

Start the server with `THIRD_CHAIR_FAKE_MODE=1 npm run dev:server`, call `/health`, then use MCP Inspector to list and invoke both tools. Verify one fake-model exploration turn, duplicate request, forced failure, and restart manually against a temporary `campaigns.sqlite`.

Expected: all automated tests PASS; `/health` is 200; Inspector sees two correctly annotated tools; one turn commits exactly once; no sentinel appears.

- [ ] **Step 6: Document evidence and commit the gate**

Record commands and observable results in `docs/operations/chair-001-gate.md` without raw state or secrets.

```bash
git add apps README.md docs/operations/chair-001-gate.md
git commit -m "feat: deliver truth core mcp slice"
git tag chair-001-gate
```
