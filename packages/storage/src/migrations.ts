import { randomUUID } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { WorldStateSchema } from "@third-chair/contracts";
import { createPreMigrationBackup, restorePreMigrationBackup } from "./backup.js";
import {
  checkpointCampaignDatabase,
  openCampaignDatabase,
  verifyDatabase,
} from "./database.js";
import { hashStoredState } from "./state-hash.js";

export interface SqliteMigration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly afterApply?: (db: DatabaseSync) => void;
}

export interface MigrationRunOptions {
  readonly migrations?: readonly SqliteMigration[];
}

export interface MigrationRunResult {
  readonly appliedVersions: readonly number[];
  readonly backupPath: string | undefined;
}

export class MigrationFailure extends Error {
  readonly backupPath: string | undefined;

  constructor(message: string, backupPath: string | undefined, cause: unknown) {
    super(message, { cause });
    this.name = "MigrationFailure";
    this.backupPath = backupPath;
  }
}

function detachedFailure(error: unknown): Error {
  return new Error(error instanceof Error ? error.message : "UNKNOWN_MIGRATION_ERROR");
}

const coreMigration: SqliteMigration = {
  version: 1,
  name: "core",
  sql: readFileSync(new URL("../migrations/001-core.sql", import.meta.url), "utf8"),
};

const creationMigration: SqliteMigration = {
  version: 2,
  name: "creation",
  sql: readFileSync(new URL("../migrations/002-creation.sql", import.meta.url), "utf8"),
};

function backfillCampaignStartCheckpoints(db: DatabaseSync): void {
  const campaigns = db.prepare(`
    SELECT id, active_branch_id, state_version, current_state_json,
           current_state_hash, created_at
    FROM campaigns ORDER BY id
  `).all() as unknown as {
    id: string;
    active_branch_id: string;
    state_version: number;
    current_state_json: string;
    current_state_hash: string;
    created_at: string;
  }[];
  for (const campaign of campaigns) {
    const earliest = db.prepare(`
      SELECT branch_id, expected_state_version AS state_version,
             before_state_json AS state_json, before_state_hash AS state_hash,
             created_at
      FROM turns WHERE campaign_id = ?
      ORDER BY expected_state_version ASC, created_at ASC, id ASC LIMIT 1
    `).get(campaign.id) as {
      branch_id: string;
      state_version: number;
      state_json: string;
      state_hash: string;
      created_at: string;
    } | undefined;
    if (!earliest && campaign.state_version !== 0) throw new Error("CAMPAIGN_START_SNAPSHOT_MISSING");
    const snapshot = earliest ?? {
      branch_id: campaign.active_branch_id,
      state_version: campaign.state_version,
      state_json: campaign.current_state_json,
      state_hash: campaign.current_state_hash,
      created_at: campaign.created_at,
    };
    const state = WorldStateSchema.parse(JSON.parse(snapshot.state_json));
    if (state.metadata.campaignId !== campaign.id || state.metadata.stateVersion !== snapshot.state_version) {
      throw new Error("CAMPAIGN_START_SNAPSHOT_MISMATCH");
    }
    if (hashStoredState(state) !== snapshot.state_hash) throw new Error("CAMPAIGN_START_HASH_MISMATCH");
    db.prepare(`
      INSERT INTO checkpoints(
        id, campaign_id, branch_id, request_id, state_version, label, reason,
        state_json, state_hash, rng_counter, created_at
      ) VALUES (?, ?, ?, ?, ?, 'Campaign Start', 'CAMPAIGN_START', ?, ?, ?, ?)
    `).run(randomUUID(), campaign.id, snapshot.branch_id, `campaign-start:${campaign.id}`,
      snapshot.state_version, JSON.stringify(state), snapshot.state_hash,
      state.metadata.rngCounter, snapshot.created_at);
  }
}

const betaMigration: SqliteMigration = {
  version: 3,
  name: "beta",
  sql: readFileSync(new URL("../migrations/003-beta.sql", import.meta.url), "utf8"),
  afterApply: backfillCampaignStartCheckpoints,
};

function orderedMigrations(migrations: readonly SqliteMigration[]): readonly SqliteMigration[] {
  const ordered = [...migrations].sort((left, right) => left.version - right.version);
  const seen = new Set<number>();
  for (const migration of ordered) {
    if (!Number.isSafeInteger(migration.version) || migration.version < 1) {
      throw new Error("INVALID_MIGRATION_VERSION");
    }
    if (migration.name.length === 0 || migration.sql.length === 0) {
      throw new Error("INVALID_MIGRATION");
    }
    if (seen.has(migration.version)) throw new Error("DUPLICATE_MIGRATION_VERSION");
    seen.add(migration.version);
  }
  return ordered;
}

function hasMigrationTable(db: DatabaseSync): boolean {
  return db.prepare(
    "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  ).get() !== undefined;
}

function pendingMigrations(
  db: DatabaseSync,
  migrations: readonly SqliteMigration[],
): readonly SqliteMigration[] {
  if (!hasMigrationTable(db)) return migrations;
  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all()
      .map((row) => Number((row as { version: number }).version)),
  );
  return migrations.filter((migration) => !applied.has(migration.version));
}

function applyMigrations(
  db: DatabaseSync,
  migrations: readonly SqliteMigration[],
): readonly number[] {
  if (migrations.length === 0) return [];
  db.exec("BEGIN IMMEDIATE");
  try {
    const appliedAt = new Date().toISOString();
    for (const migration of migrations) {
      db.exec(migration.sql);
      migration.afterApply?.(db);
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)")
        .run(migration.version, appliedAt);
    }
    db.exec("COMMIT");
    return migrations.map((migration) => migration.version);
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

function clearExactDatabaseFiles(path: string): void {
  rmSync(path, { force: true });
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
}

function migrateNewDatabase(
  databasePath: string,
  migrations: readonly SqliteMigration[],
): MigrationRunResult {
  const directory = dirname(databasePath);
  mkdirSync(directory, { recursive: true });
  const stagePath = join(directory, `.${basename(databasePath)}.${randomUUID()}.stage`);
  let db: DatabaseSync | undefined;
  let published = false;
  try {
    db = openCampaignDatabase(stagePath);
    const appliedVersions = applyMigrations(db, migrations);
    verifyDatabase(db);
    checkpointCampaignDatabase(db);
    db.close();
    db = undefined;
    linkSync(stagePath, databasePath);
    published = true;
    unlinkSync(stagePath);
    const publishedDb = openCampaignDatabase(databasePath);
    try {
      verifyDatabase(publishedDb);
    } finally {
      publishedDb.close();
    }
    return { appliedVersions, backupPath: undefined };
  } catch (error) {
    if (db?.isOpen) db.close();
    if (published) clearExactDatabaseFiles(databasePath);
    throw new MigrationFailure("DATABASE_MIGRATION_FAILED", undefined, detachedFailure(error));
  } finally {
    clearExactDatabaseFiles(stagePath);
  }
}

export function runMigrationsWithBackup(
  databasePath: string,
  options: MigrationRunOptions = {},
): MigrationRunResult {
  if (databasePath.trim().length === 0 || databasePath === ":memory:") {
    throw new Error("FILE_DATABASE_PATH_REQUIRED");
  }
  const migrations = orderedMigrations(options.migrations ?? [coreMigration, creationMigration, betaMigration]);
  if (!existsSync(databasePath)) return migrateNewDatabase(databasePath, migrations);

  let db = openCampaignDatabase(databasePath);
  let backupPath: string | undefined;
  try {
    const pending = pendingMigrations(db, migrations);
    if (pending.length === 0) return { appliedVersions: [], backupPath: undefined };
    checkpointCampaignDatabase(db);
    verifyDatabase(db);
    db.close();
    backupPath = createPreMigrationBackup(databasePath);
    db = openCampaignDatabase(databasePath);
    const appliedVersions = applyMigrations(db, pending);
    verifyDatabase(db);
    checkpointCampaignDatabase(db);
    return { appliedVersions, backupPath };
  } catch (error) {
    if (db.isOpen) db.close();
    if (backupPath !== undefined) {
      try {
        restorePreMigrationBackup(databasePath, backupPath);
      } catch (restoreError) {
        throw new MigrationFailure("DATABASE_MIGRATION_AND_RESTORE_FAILED", backupPath, {
          migrationError: detachedFailure(error),
          restoreError: detachedFailure(restoreError),
        });
      }
    }
    throw new MigrationFailure("DATABASE_MIGRATION_FAILED", backupPath, detachedFailure(error));
  } finally {
    if (db.isOpen) db.close();
  }
}
