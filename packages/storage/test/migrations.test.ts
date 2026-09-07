import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  openCampaignDatabase,
  runMigrationsWithBackup,
  hashStoredState,
  MigrationFailure,
  type SqliteMigration,
} from "@third-chair/storage";
import { createTempDatabase, decision, worldState } from "./fixtures.js";

const legacyMigrations: readonly SqliteMigration[] = [
  { version: 1, name: "core", sql: readFileSync(new URL("../migrations/001-core.sql", import.meta.url), "utf8") },
  { version: 2, name: "creation", sql: readFileSync(new URL("../migrations/002-creation.sql", import.meta.url), "utf8") },
];

function createLegacyCampaign(corruptStartHash = false) {
  const directory = mkdtempSync(join(tmpdir(), "third-chair-legacy-"));
  const path = join(directory, "campaigns.sqlite");
  runMigrationsWithBackup(path, { migrations: legacyMigrations });
  const db = openCampaignDatabase(path);
  const start = worldState(corruptStartHash ? "legacy_bad" : "legacy_good");
  const currentDecision = decision(`${corruptStartHash ? "legacy_bad" : "legacy_good"}_current`, 1);
  const current = {
    ...structuredClone(start),
    metadata: { ...start.metadata, stateVersion: 1, turnNumber: 1, rngCounter: 1 },
    currentDecision,
  };
  const branchId = `test_branch_${corruptStartHash ? "legacy_bad" : "legacy_good"}`;
  db.prepare(`INSERT INTO campaigns(
    id,owner_id,name,source_pack_hash,rng_seed,state_version,current_state_json,current_state_hash,
    current_decision_json,active_branch_id,status,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?)`).run(
    start.metadata.campaignId, "owner", "Legacy", "source", new Uint8Array(32), 1,
    JSON.stringify(current), hashStoredState(current), JSON.stringify(currentDecision), branchId,
    "2026-08-27T12:00:00.000Z", "2026-08-27T12:02:00.000Z",
  );
  db.prepare(`INSERT INTO branches(id,campaign_id,parent_branch_id,fork_turn_id,label,status,created_at)
    VALUES(?,?,NULL,NULL,'Main','ACTIVE',?)`).run(branchId, start.metadata.campaignId, "2026-08-27T12:00:00.000Z");
  db.prepare(`INSERT INTO turns(
    id,campaign_id,branch_id,client_request_id,expected_state_version,decision_id,input_hash,status,
    before_state_json,before_state_hash,locked_intents_json,resolutions_json,candidate_state_json,
    narration_json,next_decision_json,committed_state_version,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,'COMMITTED',?,?,?,?,?,?,?,?,?,?)`).run(
    `test_turn_${corruptStartHash ? "legacy_bad" : "legacy_good"}`,
    start.metadata.campaignId, branchId, `test_request_${corruptStartHash ? "legacy_bad" : "legacy_good"}`,
    0, start.currentDecision.id, "input", JSON.stringify(start),
    corruptStartHash ? "0".repeat(64) : hashStoredState(start), "[]",
    JSON.stringify({ resolutions: [], nextRngCounter: 1 }), JSON.stringify(current),
    JSON.stringify({ sceneText: "A first future." }), JSON.stringify(currentDecision), 1,
    "2026-08-27T12:01:00.000Z", "2026-08-27T12:02:00.000Z",
  );
  db.close();
  return { directory, path, campaignId: start.metadata.campaignId, start, branchId };
}

describe("campaign database migrations", () => {
  it("enables and verifies foreign keys, WAL, and a finite busy timeout", () => {
    const temp = createTempDatabase();
    try {
      expect(temp.db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
      expect(temp.db.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
      const timeout = temp.db.prepare("PRAGMA busy_timeout").get() as { timeout: number };
      expect(timeout.timeout).toBeGreaterThan(0);
      expect(timeout.timeout).toBeLessThanOrEqual(30_000);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("creates the exact campaign-beta tables and indexes once", () => {
    const temp = createTempDatabase();
    try {
      runMigrationsWithBackup(temp.path);
      const tables = temp.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((row) => (row as { name: string }).name);
      expect(tables).toEqual([
        "active_turns",
        "branches",
        "campaign_creation_requests",
        "campaigns",
        "checkpoints",
        "exports",
        "journals",
        "schema_migrations",
        "sqlite_sequence",
        "turn_events",
        "turn_recovery_commands",
        "turns",
      ]);
      const indexes = temp.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name")
        .all()
        .map((row) => (row as { name: string }).name);
      expect(indexes).toEqual([
        "campaign_creation_status_idx",
        "checkpoints_campaign_version_idx",
        "recovery_commands_turn_idx",
        "turn_events_turn_idx",
        "turns_campaign_status_idx",
      ]);
      expect(temp.db.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("backs up an existing file database before applying a pending migration", () => {
    const temp = createTempDatabase();
    const migration: SqliteMigration = {
      version: 4,
      name: "add_marker",
      sql: "CREATE TABLE migration_marker (value TEXT NOT NULL);",
    };
    try {
      temp.close();
      const result = runMigrationsWithBackup(temp.path, { migrations: [migration] });
      expect(result.appliedVersions).toEqual([4]);
      expect(result.backupPath).toBeDefined();
      expect(existsSync(result.backupPath!)).toBe(true);
      const reopened = openCampaignDatabase(temp.path);
      expect(reopened.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
      expect(reopened.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([
        { version: 1 },
        { version: 2 },
        { version: 3 },
        { version: 4 },
      ]);
      reopened.close();
    } finally {
      temp.cleanup();
    }
  });

  it("backfills Campaign Start from the earliest verified committed snapshot", () => {
    const legacy = createLegacyCampaign();
    try {
      expect(runMigrationsWithBackup(legacy.path).appliedVersions).toEqual([3]);
      const db = openCampaignDatabase(legacy.path);
      try {
        const row = db.prepare(`SELECT branch_id,state_version,label,reason,state_json,state_hash,rng_counter
          FROM checkpoints WHERE campaign_id=?`).get(legacy.campaignId) as Record<string, unknown>;
        expect(row).toMatchObject({
          branch_id: legacy.branchId,
          state_version: 0,
          label: "Campaign Start",
          reason: "CAMPAIGN_START",
          state_hash: hashStoredState(legacy.start),
          rng_counter: 0,
        });
        expect(JSON.parse(row.state_json as string)).toEqual(legacy.start);
      } finally {
        db.close();
      }
    } finally {
      rmSync(legacy.directory, { recursive: true, force: true });
    }
  });

  it("aborts and restores a legacy database whose earliest snapshot hash is invalid", () => {
    const legacy = createLegacyCampaign(true);
    try {
      expect(() => runMigrationsWithBackup(legacy.path)).toThrow(MigrationFailure);
      const db = openCampaignDatabase(legacy.path);
      try {
        expect(db.prepare("SELECT version FROM schema_migrations ORDER BY version").all())
          .toEqual([{ version: 1 }, { version: 2 }]);
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='checkpoints'").get())
          .toBeUndefined();
      } finally {
        db.close();
      }
    } finally {
      rmSync(legacy.directory, { recursive: true, force: true });
    }
  });
});
