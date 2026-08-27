# CHAIR-005 Campaign Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the proven table into a durable campaign beta with guided two-character creation, sourced hidden campaign-spine creation, automatic and named checkpoints, branch-preserving rewind, spoiler-safe journals, portable SaveSets, a production-like local Docker handoff, and a twelve-decision real-model acceptance session.

**Architecture:** Extend the deterministic contracts and repositories rather than adding new model authority. Character and campaign creation produce validated structured state; the Director proposes a three-route hidden spine through a separate bounded output contract; checkpoint/rewind are repository transactions; journals are derived from visible committed records; SaveSets are checksummed archives with separate player-safe and full-private modes. The final plugin and widget expose only the implemented lifecycle operations.

**Tech Stack:** Node.js 24 LTS, TypeScript, Zod 4, Vitest, `node:sqlite`, `fflate`, the existing Agents/MCP/React packages, and Docker.

**Spec:** `docs/superpowers/specs/2026-08-27-third-chair-design.md`

## Global Constraints

- Character choices must be present in the private SRD 5.1 `character_options` index or be explicitly labeled campaign-generated house content.
- Bill chooses Bill's character; foreground Raven chooses Raven's character. Neither seat is filled by the server.
- Campaign-spine creation has exactly three materially different clue/leverage routes, at least two plausible outcomes, sourced setting claims, and explicit `CAMPAIGN_GENERATED` labels.
- Campaign creation is idempotent and commits no partial campaign when model generation or validation fails.
- Automatic checkpoints occur before death risk, irreversible faction allegiance/betrayal, permanent rare-resource spend, major branch closure, and level advancement.
- Rewind never deletes history. It abandons the old branch, creates a new branch, increments the monotonic campaign state version, restores world fields and RNG counter, and preserves the ledger.
- `PLAYER_SAFE` SaveSets exclude Director state and cannot be re-imported as campaign truth.
- `FULL_PRIVATE` SaveSets contain spoilers and the RNG seed, require explicit confirmation, and are the only lossless re-import format.
- V1 `FULL_PRIVATE` import is exact restore, not clone: it preserves the archived campaign ID and every identity-bearing state/hash/RNG/lineage value, and refuses the restore if that archived ID already exists in the destination database.
- Neither SaveSet mode contains source PDFs, OCR text, source chunks, raw prompts, traces, cache files, or credentials.
- Runtime Docker images do not include Poppler, OCRmyPDF, Tesseract, or source-building code paths beyond read-only source-pack access.
- Public hosting, OAuth, full-book OCR, manual dice, maps, voice, visual gallery, and public plugin submission remain deferred.

---

### Task 1: Add Guided Level-One Character Creation

**Files:**
- Create: `packages/contracts/src/characters.ts`
- Modify: `packages/contracts/src/world-state.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/engine/src/creation/catalog.ts`
- Create: `packages/engine/src/creation/character-builder.ts`
- Create: `packages/engine/src/creation/validate-character.ts`
- Create: `packages/engine/test/fixtures/character-catalog.json`
- Test: `packages/engine/test/creation/character-builder.test.ts`
- Test: `packages/engine/test/creation/character-ownership.test.ts`
- Test: `packages/engine/test/creation/derived-stats.test.ts`

**Interfaces:**
- Consumes: source-pack `character_options`, a seat, standard array assignments, and validated choice keys.
- Produces: `CharacterDraftSchema`, `CharacterBuildSchema`, `CharacterCatalog`, `listCharacterChoices`, `buildLevelOneCharacter`, and `validateCharacterOwnership`.

- [ ] **Step 1: Write failing guided-build tests**

Use a synthetic catalog rather than copied SRD prose. Cover valid standard-array assignment, duplicate ability scores, unavailable option keys, wrong-seat actor control, equipment choice groups, prepared/known spell bounds, HP/AC/proficiency derivation, and a generic pack that does not imply individual items.

```ts
expect(buildLevelOneCharacter(validBillDraft, catalog).controller).toBe("BILL");
expect(() => buildLevelOneCharacter({ ...validBillDraft, controller: "RAVEN" }, catalog))
  .toThrow("CHARACTER_SEAT_MISMATCH");
expect(() => buildLevelOneCharacter(duplicateStandardArray, catalog))
  .toThrow("INVALID_STANDARD_ARRAY_ASSIGNMENT");
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/engine/test/creation`

- [ ] **Step 3: Define exact character contracts**

```ts
export const CharacterDraftSchema = z.object({
  actorId: PersistedIdSchema,
  controller: z.enum(["BILL", "RAVEN"]),
  name: z.string().trim().min(1).max(80),
  pronouns: z.string().trim().max(80),
  ancestryKey: z.string().min(1),
  classKey: z.string().min(1),
  backgroundKey: z.string().min(1),
  abilityMethod: z.literal("STANDARD_ARRAY"),
  abilities: z.object({
    strength: z.number().int(), dexterity: z.number().int(), constitution: z.number().int(),
    intelligence: z.number().int(), wisdom: z.number().int(), charisma: z.number().int(),
  }),
  skillKeys: z.array(z.string()),
  equipmentChoiceKeys: z.array(z.string()),
  spellKeys: z.array(z.string()),
  characterHook: z.string().trim().max(500),
});
```

`CharacterBuild` contains no free-form mechanical values. The builder derives level 1, proficiency bonus, hit points, AC, saves, skills, resources, spell slots, speed, equipment IDs, and feature source references from catalog data.

- [ ] **Step 4: Implement source-backed catalog and deterministic derivation**

Load only structured `character_options.option_json`; never parse a rule passage during live creation. Require the six ability values to be exactly the multiset `[15,14,13,12,10,8]` before ancestry adjustments. Validate catalog choice-group cardinality and spell availability. Return source citations by rule-section ID, not copied text.

- [ ] **Step 5: Prove seat autonomy**

`validateCharacterOwnership()` requires one Bill build and one Raven build, distinct actor IDs, and matching controllers. It cannot create a missing draft. Tests pass a missing Raven draft and require `AWAITING_RAVEN_CHARACTER`, not a default character.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- packages/engine/test/creation && npm run typecheck`

```bash
git add packages/contracts packages/engine
git commit -m "feat: add sourced two-seat character creation"
```

---

### Task 2: Generate and Atomically Create a Three-Route Campaign

**Files:**
- Create: `packages/contracts/src/campaign-creation.ts`
- Create: `packages/agents/prompts/campaign-spine.md`
- Create: `packages/agents/src/campaign-spine.ts`
- Create: `packages/engine/src/creation/campaign-builder.ts`
- Create: `packages/storage/migrations/002-creation.sql`
- Create: `apps/server/src/mcp/tools/create-campaign.ts`
- Modify: `apps/server/src/mcp/server.ts`
- Test: `packages/agents/test/campaign-spine.test.ts`
- Test: `packages/engine/test/creation/campaign-builder.test.ts`
- Test: `apps/server/test/create-campaign.test.ts`

**Interfaces:**
- Consumes: two validated characters, source-pack binding, campaign name, optional boundaries/tone, and a separate bounded campaign-spine agent run.
- Produces: `CampaignCreationRequestSchema`, `CampaignSpineProposalSchema`, `createCampaign()`, and MCP tool `create_campaign`.

- [ ] **Step 1: Write failing spine and atomicity tests**

Reject two equivalent clue routes, fewer or more than three routes, fewer than two outcomes, setting facts without citations, invented facts without `CAMPAIGN_GENERATED`, a start date other than 1375 DR, a missing player character, and a partial campaign row after agent failure. Prove a duplicate request ID returns the same campaign ID.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/agents/test/campaign-spine.test.ts packages/engine/test/creation/campaign-builder.test.ts apps/server/test/create-campaign.test.ts`

- [ ] **Step 3: Define the campaign-spine output**

`CampaignSpineProposal` contains opening location/pressure, one central hidden truth, exactly three routes with different `method` enum values (`SOCIAL_LEVERAGE`, `INVESTIGATION_DISCOVERY`, `FACTION_OR_TRAVEL`), factions with goals and six-segment clocks, NPC relationships and contradictions, at least two outcomes, starting clues, risk tags, setting citations, and generated facts. Every record carries an audience; core truth, unrevealed clocks, NPC intentions, and outcomes begin `DIRECTOR`.

- [ ] **Step 4: Add the idempotent creation-request migration**

```sql
CREATE TABLE campaign_creation_requests (
  request_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROCESSING','COMMITTED','FAILED')),
  campaign_id TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 5: Write the campaign-spine prompt and adapter**

The prompt asks for a compact playable spine, not prose. It anchors the first fixture in the Dalelands at 1375 DR; requires retrieval tools for authored claims; forbids 3e mechanics; requires material pressures such as law, livelihood, reputation, terrain, faction incentives, or resources; and forbids making every route a variant of the same clue. Use the Director model profile, fresh run, strict output schema, and no durable session.

- [ ] **Step 6: Implement atomic campaign creation**

Validate both characters and source-pack manifest hash before model work. Record an idempotent creation request without exposing it through `list_campaigns`. Generate and validate the spine, build the initial `WorldState`, root branch, RNG seed, opening `DecisionRequest(owner: "BOTH")`, and initial visible journal in memory. Commit campaign, branch, state, and creation request result in one SQLite transaction. On failure, mark only the creation request failed. Task 3 backfills the immutable campaign-start checkpoint when checkpoint storage is introduced.

- [ ] **Step 7: Register `create_campaign` accurately**

Annotations are `{ readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true }`. The result contains campaign ID, source hash, visible opening, both public character cards, current decision, and `playerViewId`; it contains no spine or Director fact.

- [ ] **Step 8: Run tests and commit**

Run: `npm test -- packages/agents/test/campaign-spine.test.ts packages/engine/test/creation apps/server/test/create-campaign.test.ts && npm run typecheck`

```bash
git add packages/contracts packages/agents packages/engine apps/server
git commit -m "feat: create sourced three-route campaigns"
```

---

### Task 3: Add Checkpoints, Branch-Preserving Rewind, and Replay

**Files:**
- Create: `packages/storage/migrations/003-beta.sql`
- Create: `packages/storage/src/checkpoint-repository.ts`
- Create: `packages/contracts/src/checkpoints.ts`
- Create: `packages/engine/src/checkpoints/policy.ts`
- Create: `packages/engine/src/checkpoints/rewind.ts`
- Create: `apps/server/src/mcp/tools/create-checkpoint.ts`
- Create: `apps/server/src/mcp/tools/rewind-to-checkpoint.ts`
- Modify: `apps/server/src/mcp/server.ts`
- Test: `packages/storage/test/checkpoints.test.ts`
- Test: `packages/engine/test/checkpoints/auto-policy.test.ts`
- Test: `packages/engine/test/checkpoints/rewind.test.ts`
- Test: `apps/server/test/checkpoint-tools.test.ts`

**Interfaces:**
- Consumes: committed campaign state/branch, checkpoint risk tags, request IDs, and expected state versions.
- Produces: `CheckpointRepository`, `CheckpointPolicy`, `createCheckpoint`, `rewindToCheckpoint`, `create_checkpoint`, and `rewind_to_checkpoint`.

- [ ] **Step 1: Write failing checkpoint and branch tests**

Cover named checkpoint idempotency, duplicate label conflict, all five automatic triggers, no checkpoint on ordinary low-risk turns, stale-version rewind rejection, old-branch preservation, new monotonic state version, restored RNG counter, and same-roll replay after rewind.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/storage/test/checkpoints.test.ts packages/engine/test/checkpoints apps/server/test/checkpoint-tools.test.ts`

- [ ] **Step 3: Add beta tables**

```sql
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  state_version INTEGER NOT NULL,
  label TEXT NOT NULL,
  reason TEXT NOT NULL,
  state_json TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  rng_counter INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(campaign_id, branch_id, label)
);

CREATE TABLE journals (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  state_version INTEGER NOT NULL,
  audience TEXT NOT NULL,
  journal_json TEXT NOT NULL,
  journal_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(campaign_id, state_version, audience)
);

CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  state_version INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('PLAYER_SAFE','FULL_PRIVATE')),
  request_id TEXT NOT NULL,
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(campaign_id, request_id)
);
```

- [ ] **Step 4: Implement automatic policy in the final commit transaction**

`CheckpointPolicy` consumes typed risk tags from a validated proposal plus deterministic state differences. A required checkpoint is inserted from the before-state inside the same final commit transaction, before the campaign row changes. Tags are `DEATH_RISK`, `IRREVERSIBLE_ALLEGIANCE`, `PERMANENT_RARE_RESOURCE`, `MAJOR_BRANCH_CLOSURE`, and `LEVEL_ADVANCEMENT`.

After migration, backfill one `Campaign Start` checkpoint for every existing campaign from the earliest committed state snapshot. Validate the snapshot hash before insert; abort migration rather than inventing a missing snapshot.

- [ ] **Step 5: Implement rewind transaction**

With `BEGIN IMMEDIATE`: recheck current version and active branch; insert a `REWIND` turn record; mark old branch `ABANDONED`; insert a new `ACTIVE` branch pointing to the rewind turn; clone checkpoint state; replace its `metadata.stateVersion` with current version + 1 while preserving checkpoint world fields and `rngCounter`; set a new player decision describing table-control recovery; update campaign row; commit. Never update or delete old turns/checkpoints.

- [ ] **Step 6: Register tools and annotations**

`create_checkpoint` is mutating, non-destructive, closed-world, idempotent. `rewind_to_checkpoint` is mutating, destructive, closed-world, idempotent and requires `confirmed: true` plus expected state version. A duplicate rewind request returns the same new branch/version.

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- packages/storage/test/checkpoints.test.ts packages/engine/test/checkpoints apps/server/test/checkpoint-tools.test.ts && npm run typecheck`

```bash
git add packages/storage packages/contracts packages/engine apps/server
git commit -m "feat: preserve campaign branches through rewind"
```

---

### Task 4: Derive Spoiler-Safe Journals and Session Summaries

**Files:**
- Create: `packages/contracts/src/journal.ts`
- Create: `packages/engine/src/journal/build-journal.ts`
- Create: `packages/engine/src/journal/render-markdown.ts`
- Modify: `packages/engine/src/turn/turn-engine.ts`
- Test: `packages/engine/test/journal/journal.test.ts`
- Test: `packages/engine/test/journal/sentinel.test.ts`
- Test: `packages/storage/test/journal-atomicity.test.ts`

**Interfaces:**
- Consumes: committed `PlayerView`, visible events/resolutions, quests, clues, status, inventory, and accepted rulings.
- Produces: `PlayerJournalSchema`, `buildPlayerJournal(view, recentVisibleTurns)`, and `renderPlayerJournalMarkdown(journal)`.

- [ ] **Step 1: Write failing journal and leak tests**

Assert current objective, immediate risk, known NPCs/clues, inventory/currency, XP, HP/conditions/resources, and open threads appear when visible. Assert Director truth, hidden clocks, secret NPC goals, unrevealed exits, Raven-only memories in Bill journal, and raw source text never appear. Inject journal failure and prove the turn does not commit.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/engine/test/journal packages/storage/test/journal-atomicity.test.ts`

- [ ] **Step 3: Implement deterministic journal derivation**

Build structured journal fields from `PlayerView` and at most the last twenty visible turn summaries. Do not call a third agent. Use stable ordering by objective priority, recency, and ID. Narrative summaries reuse validated visible narration excerpts capped at 240 characters; they cannot introduce new facts.

- [ ] **Step 4: Commit journals atomically**

Generate Bill, Raven, and Party journal projections before `commitTurn()`, validate sentinel/forbidden keys, and write journal rows in the same transaction as state and narration. Render Markdown only during export/read; JSON remains authority.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- packages/engine/test/journal packages/storage/test/journal-atomicity.test.ts && npm run typecheck`

```bash
git add packages/contracts packages/engine packages/storage
git commit -m "feat: derive atomic spoiler-safe journals"
```

---

### Task 5: Export and Re-import Checksummed SaveSets

**Files:**
- Create: `packages/contracts/src/saveset.ts`
- Create: `packages/engine/src/saveset/manifest.ts`
- Create: `packages/engine/src/saveset/export.ts`
- Create: `packages/engine/src/saveset/import.ts`
- Create: `packages/engine/src/saveset/zip.ts`
- Create: `apps/server/src/mcp/tools/export-campaign.ts`
- Create: `apps/server/src/mcp/export-resource.ts`
- Create: `scripts/import-saveset.mjs`
- Modify: `apps/server/src/mcp/server.ts`
- Test: `packages/engine/test/saveset/player-safe.test.ts`
- Test: `packages/engine/test/saveset/full-private.test.ts`
- Test: `packages/engine/test/saveset/import.test.ts`
- Test: `apps/server/test/export-campaign.test.ts`

**Interfaces:**
- Consumes: committed state/version, journals, ledgers, checkpoints, branches, rulings, source-pack manifest hash, mode, and request ID.
- Produces: `SaveSetManifestSchema`, `exportSaveSet`, `importFullPrivateSaveSet`, `export_campaign`, and resource template `third-chair://exports/{exportId}`.

- [ ] **Step 1: Write failing privacy, integrity, and zip-slip tests**

Assert `PLAYER_SAFE` contains no hidden sentinel, RNG seed, full world state, or private ledger and is rejected by import. Assert `FULL_PRIVATE` exact restore preserves the original campaign ID, state and state hash, RNG seed/counter, turns, checkpoints, branches, lineage, and canonical hashes. Restore into a separate empty destination database and reject the restore when that archived campaign ID already exists. Alter one archive byte and require checksum failure. Include `../escape` and absolute paths in a malicious archive and require rejection before writing.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- packages/engine/test/saveset apps/server/test/export-campaign.test.ts`

- [ ] **Step 3: Install and define the archive format**

Run: `npm install fflate --workspace @third-chair/engine`

Both modes contain `manifest.json`, `characters.json`, `journal.md`, `rulings.json`, `citations.json`, and `branches.json`. `PLAYER_SAFE` adds only `player-view.json` and visible turn summaries. `FULL_PRIVATE` adds `private/world-state.json`, `private/rng.json`, `private/turns.jsonl`, `private/checkpoints.json`, and `private/creation.json`. `manifest.json` lists schema version, mode, campaign ID/name, state version/hash, source-pack manifest hash, branch ID, created time, and SHA-256 for every member.

- [ ] **Step 4: Implement safe export/import**

Build in memory or a unique ignored temporary directory, cap archive at 250 MiB and each member at 50 MiB, normalize forward-slash paths, reject duplicate/case-colliding names, and write the final ZIP atomically. Import validates all member hashes and Zod schemas, exact source-pack hash, absence of unexpected members, and absence of the archived campaign ID in the destination before opening a database transaction. It then restores the original campaign ID, RNG seed/counter, state, turns, checkpoints, branches, lineage, and hashes without rewriting identity-bearing data. V1 has no clone path.

- [ ] **Step 5: Expose export without exposing a filesystem path**

`export_campaign` input is campaign ID, expected version, request ID, mode, and `confirmedSpoilers`. `FULL_PRIVATE` requires `confirmedSpoilers: true`. Annotations are write/non-destructive/closed-world/idempotent. Store the artifact under ignored `data/exports`, register an owner-checked expiring MCP resource `third-chair://exports/{exportId}` with MIME `application/zip`, and return a `resource_link` plus size/hash. Never return an absolute local path.

- [ ] **Step 6: Implement operator-only import**

`scripts/import-saveset.mjs` accepts one explicit archive path and destination database configuration, opens the current source pack read-only, runs dry-run validation by default, and requires `--apply` to write. It never accepts a replacement campaign ID: the manifest campaign ID is preserved and must not already exist in the destination database. There is no public MCP import tool in V1. A future separately designed `CLONE` command may assign a new identity, rewrite identity-bearing records and hashes, and accept a different future RNG stream.

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- packages/engine/test/saveset apps/server/test/export-campaign.test.ts && npm run typecheck`

```bash
git add package.json package-lock.json packages/contracts packages/engine apps/server scripts/import-saveset.mjs
git commit -m "feat: export portable checksummed campaign saves"
```

---

### Task 6: Finish Lifecycle Tools, Widget Controls, and Campaign Skill

**Files:**
- Modify: `apps/server/src/mcp/server.ts`
- Modify: `apps/widget/src/components/RecoveryStrip.tsx`
- Create: `apps/widget/src/components/CheckpointPanel.tsx`
- Modify: `apps/widget/src/App.tsx`
- Modify: `plugins/third-chair/skills/third-chair-campaign/SKILL.md`
- Modify: `plugins/third-chair/.codex-plugin/plugin.json`
- Modify: `evals/cases/skill-third-chair-campaign.jsonl`
- Test: `apps/server/test/final-tool-surface.test.ts`
- Test: `apps/widget/src/components/CheckpointPanel.test.tsx`
- Test: `apps/server/test/widget-lifecycle-actions.test.ts`

**Interfaces:**
- Consumes: creation, checkpoint, rewind, and export services.
- Produces: final ten-tool MCP surface, checkpoint/rewind widget controls, and complete campaign-management skill.

- [ ] **Step 1: Write failing final-surface and UI confirmation tests**

Assert the advertised tools are exactly: `list_campaigns`, `create_campaign`, `get_table_view`, `advance_game`, `answer_rules`, `recall_known_lore`, `create_checkpoint`, `rewind_to_checkpoint`, `render_table`, and `export_campaign`. Test annotation matrix, stale versions, duplicate IDs, and widget confirmation that includes checkpoint label/state version before calling destructive rewind.

- [ ] **Step 2: Run RED behavioral baselines for the revised campaign skill**

Without the revised skill, test create, named checkpoint, rewind regret, player-safe export, full-private export, and source-hash mismatch. Record unsafe missing confirmation, wrong export mode, or invented recovery behavior.

- [ ] **Step 3: Implement widget lifecycle controls**

Checkpoint creation uses `tools/call` with a generated UUID request ID and current version. Rewind opens an accessible confirmation panel showing abandoned branch consequence, checkpoint label, and target state version; only the explicit confirm button calls the tool. Export defaults to `PLAYER_SAFE`; `FULL_PRIVATE` requires a separate spoiler warning. Refresh the table after every successful call.

- [ ] **Step 4: Revise the campaign skill from observed failures**

Update its description to:

```yaml
description: Use when creating, listing, resuming, checkpointing, rewinding, exporting, importing, or auditing a Third Chair campaign outside the live action loop.
```

Add positive recipes for two-seat creation, checkpoint, destructive rewind confirmation, `PLAYER_SAFE` versus `FULL_PRIVATE`, operator-only import, and source-hash mismatch. Never reconstruct state from chat and never silently select a campaign/checkpoint when names are ambiguous.

- [ ] **Step 5: Run GREEN/pressure tests and validate the skill again**

Required pass conditions: Bill chooses Bill's character; Raven chooses Raven's; destructive rewind has explicit confirmation; full-private warning appears; import is never attempted through a nonexistent MCP tool; hash mismatch becomes read-only/migration guidance.

- [ ] **Step 6: Bump and validate plugin**

Bump `plugin.json` from `0.1.0` to `0.2.0`, run skill and plugin validators, rebuild the widget, refresh ChatGPT connection metadata, and rerun the affected host-loop prompts.

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- apps/server/test/final-tool-surface.test.ts apps/server/test/widget-lifecycle-actions.test.ts --project widget && npm run build && npm run typecheck`

```bash
git add apps plugins/third-chair evals/cases/skill-third-chair-campaign.jsonl
git commit -m "feat: complete campaign lifecycle controls"
```

---

### Task 7: Containerize the Private Runtime and Document Operations

**Files:**
- Create: `docker/Dockerfile`
- Create: `docker/compose.yaml`
- Create: `apps/server/src/startup.ts`
- Create: `docs/operations/local-deploy.md`
- Create: `docs/operations/recovery.md`
- Modify: `README.md`
- Modify: `packages/storage/src/backup.ts`
- Test: `apps/server/test/startup.test.ts`
- Modify: `packages/storage/test/backup.test.ts`

**Interfaces:**
- Consumes: built server/widget, writable campaign data directory, read-only source pack, environment config, OpenAI key at runtime, and the CHAIR-001 migration backup/restore primitive already used by migrations `002` and `003`.
- Produces: non-root local Docker service on loopback, startup integration of the generic migration protection, `/health`, and recovery runbook.

- [ ] **Step 1: Write failing startup and backup tests**

Test missing source pack, per-campaign hash mismatch, unwritable data directory, failed migration restore through the existing generic primitive, absent widget build, normal-play tracing accidentally enabled, and clean readiness. Missing or mismatched source data must leave list/view/player-safe export available while blocking campaign mutation with an explicit read-only recovery status. Assert logs contain codes/IDs but not paths, keys, source text, hidden state, or prompts.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- apps/server/test/startup.test.ts packages/storage/test/backup.test.ts`

- [ ] **Step 3: Implement startup preflight**

Validate config; create only the explicit data/export directories; acquire the single-process startup lock; invoke the foundational `runMigrationsWithBackup()` path (which checkpoints WAL, protects every pending migration, and restores on failure); validate widget resource; enforce tracing policy; then evaluate source bindings. A valid mounted pack yields `ready`. A missing pack or a campaign bound to a different `sourcePackManifestHash` yields `degraded`: list/view/player-safe export remain available, affected campaigns project `READ_ONLY`, and every mutation returns `SOURCE_PACK_UNAVAILABLE` or `SOURCE_PACK_HASH_MISMATCH`. A migration/database/widget failure exits non-zero; migration restoration is owned by the generic storage primitive rather than reimplemented here.

- [ ] **Step 4: Build a runtime-only container**

Use `node:24-bookworm-slim` for builder and runtime stages. Builder runs `npm ci`, tests are not skipped in the documented release command, and builds workspaces. Runtime copies production dependencies and dist output, runs as an unprivileged user, exposes 8787, and contains no PDF/OCR packages. Compose binds `127.0.0.1:8787:8787`, mounts `./data:/app/data`, mounts `./private/source-pack.sqlite:/app/private/source-pack.sqlite:ro`, passes secrets only through environment, and defines a `/health` check.

- [ ] **Step 5: Test container and recovery**

Run:

```bash
docker compose -f docker/compose.yaml build
docker compose -f docker/compose.yaml up -d
curl -fsS http://127.0.0.1:8787/health
docker compose -f docker/compose.yaml restart
curl -fsS http://127.0.0.1:8787/health
```

Stop the service, corrupt a disposable copied database, and verify startup restores the pre-migration backup and refuses readiness. Never test corruption against Bill's actual campaign file.

- [ ] **Step 6: Commit**

```bash
git add docker apps/server packages/storage docs/operations README.md
git commit -m "feat: containerize private third chair runtime"
```

---

### Task 8: Run the Twelve-Decision Campaign Beta Gate

**Files:**
- Create: `evals/cases/chair-005-beta.jsonl`
- Create: `evals/fixtures/beta-boundaries.json`
- Create: `scripts/run-beta.mjs`
- Create: `docs/operations/beta-script.md`
- Create: `docs/operations/chair-005-gate.md`

**Interfaces:**
- Consumes: built Docker service, private source pack, installed plugin, fresh Dalelands campaign, two chosen characters, and real Director/Narrator models.
- Produces: redacted beta event record, latency summary, sentinel report, restart/rewind/export evidence, and final gate decision.

- [ ] **Step 1: Write the beta harness tests**

The harness must reject fewer than twelve meaningful committed decisions, repeated no-op decisions counted as progress, missing required modes, a sentinel occurrence, state-version gaps, duplicate roll counters, manual database repair, missing restart evidence, or an unverified SaveSet import.

- [ ] **Step 2: Define meaningful-decision coverage**

The twelve-decision session must include at least:

- three exploration decisions;
- two social decisions with distinct NPC pressures;
- three uncertain actions including success and failure;
- one failure-forward resolution after repeated obstruction;
- one Bill-owned reaction/resource commitment;
- one Raven-owned autonomous decision;
- one full combat round with Bill, Raven, and Director actors;
- one checkpoint and rewind branch;
- one rules question that does not mutate state.

One decision may satisfy multiple categories, but twelve distinct committed decision bundles are still required.

- [ ] **Step 3: Implement redacted event capture**

`run-beta.mjs` records timestamps, tool name, request ID hash, before/after versions and hashes, decision owner/mode, visible resolution IDs/counters, branch/checkpoint IDs, model profile, latency, retry/failure codes, widget update token, and PASS/FAIL checks. It never records character dialogue, narration, hidden facts, source text, prompts, or keys.

- [ ] **Step 4: Run preflight and start a fresh campaign**

Run full offline tests, build the container, verify source hash, refresh MCP metadata/plugin version, and create a named pre-beta backup. Bill supplies Bill's character; foreground Raven supplies Raven's character. Campaign creation must return three-route validation evidence without revealing route contents.

- [ ] **Step 5: Execute failure and restart injections during play**

After decision 4, restart the container and resume the exact decision. During a later check-bearing turn, inject a failure after rolls persist and verify retry reuses natural dice. During another turn, inject one Narrator failure and verify retry sees the identical visible candidate. No campaign state may change before successful final commit.

- [ ] **Step 6: Exercise rewind and SaveSet recovery**

Create a named checkpoint, play at least one branch decision, rewind, verify the old branch is `ABANDONED`, replay the same check and confirm deterministic dice, then explicitly create a `FULL_PRIVATE` SaveSet. Copy an empty destination database, dry-run the exact restore against the same source-pack hash, apply it while preserving the archived campaign ID, and compare state/RNG/ledger/checkpoint/branch/lineage hashes. Attempt the same restore where that campaign ID already exists and require rejection. Also create a `PLAYER_SAFE` SaveSet and prove import rejects it.

- [ ] **Step 7: Calculate acceptance evidence**

Require:

1. Twelve meaningful decisions with exploration, social, uncertainty, and combat coverage.
2. Zero sentinel leaks across PlayerView, Narrator input, MCP partitions, widget payloads, journals, and player-safe export.
3. No duplicate turn commit or RNG counter.
4. Exact restart recovery and no manual database edit.
5. Checkpoint rewind plus deterministic replay.
6. Full-private exact-restore equality, including original campaign ID, RNG seed/counter, state, turns, checkpoints, branches, lineage, and hashes, against the same source-pack hash.
7. Widget state always matches committed state version.
8. Observed median non-image decision latency under 20 seconds and p95 under 45 seconds, or a documented optimization blocker before adding any agent.

- [ ] **Step 8: Run final verification, review, and gate commit**

Use `superpowers:verification-before-completion` and `superpowers:requesting-code-review`. Run:

```bash
npm run verify:private
npm run typecheck
npm test
npm run build
npm run source-pack -- test-fixtures --database private/source-pack.sqlite
node scripts/run-beta.mjs --verify evals/results/chair-005-beta.json
docker compose -f docker/compose.yaml config
```

Record only redacted results in `chair-005-gate.md`. If any criterion fails, do not tag the release.

When all pass:

```bash
git add evals/cases/chair-005-beta.jsonl evals/fixtures/beta-boundaries.json scripts/run-beta.mjs docs/operations
git commit -m "feat: qualify third chair campaign beta"
git tag third-chair-beta-0.2.0
```
