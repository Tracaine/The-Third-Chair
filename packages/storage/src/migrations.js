import { randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, unlinkSync, } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createPreMigrationBackup, restorePreMigrationBackup } from "./backup.js";
import { checkpointCampaignDatabase, openCampaignDatabase, verifyDatabase, } from "./database.js";
export class MigrationFailure extends Error {
    backupPath;
    constructor(message, backupPath, cause) {
        super(message, { cause });
        this.name = "MigrationFailure";
        this.backupPath = backupPath;
    }
}
const coreMigration = {
    version: 1,
    name: "core",
    sql: readFileSync(new URL("../migrations/001-core.sql", import.meta.url), "utf8"),
};
function orderedMigrations(migrations) {
    const ordered = [...migrations].sort((left, right) => left.version - right.version);
    const seen = new Set();
    for (const migration of ordered) {
        if (!Number.isSafeInteger(migration.version) || migration.version < 1) {
            throw new Error("INVALID_MIGRATION_VERSION");
        }
        if (migration.name.length === 0 || migration.sql.length === 0) {
            throw new Error("INVALID_MIGRATION");
        }
        if (seen.has(migration.version))
            throw new Error("DUPLICATE_MIGRATION_VERSION");
        seen.add(migration.version);
    }
    return ordered;
}
function hasMigrationTable(db) {
    return db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get() !== undefined;
}
function pendingMigrations(db, migrations) {
    if (!hasMigrationTable(db))
        return migrations;
    const applied = new Set(db.prepare("SELECT version FROM schema_migrations").all()
        .map((row) => Number(row.version)));
    return migrations.filter((migration) => !applied.has(migration.version));
}
function applyMigrations(db, migrations) {
    if (migrations.length === 0)
        return [];
    db.exec("BEGIN IMMEDIATE");
    try {
        const appliedAt = new Date().toISOString();
        for (const migration of migrations) {
            db.exec(migration.sql);
            db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)")
                .run(migration.version, appliedAt);
        }
        db.exec("COMMIT");
        return migrations.map((migration) => migration.version);
    }
    catch (error) {
        if (db.isTransaction)
            db.exec("ROLLBACK");
        throw error;
    }
}
function clearExactDatabaseFiles(path) {
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
}
function migrateNewDatabase(databasePath, migrations) {
    const directory = dirname(databasePath);
    mkdirSync(directory, { recursive: true });
    const stagePath = join(directory, `.${basename(databasePath)}.${randomUUID()}.stage`);
    let db;
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
        }
        finally {
            publishedDb.close();
        }
        return { appliedVersions, backupPath: undefined };
    }
    catch (error) {
        if (db?.isOpen)
            db.close();
        if (published)
            clearExactDatabaseFiles(databasePath);
        throw new MigrationFailure("DATABASE_MIGRATION_FAILED", undefined, error);
    }
    finally {
        clearExactDatabaseFiles(stagePath);
    }
}
export function runMigrationsWithBackup(databasePath, options = {}) {
    if (databasePath.trim().length === 0 || databasePath === ":memory:") {
        throw new Error("FILE_DATABASE_PATH_REQUIRED");
    }
    const migrations = orderedMigrations(options.migrations ?? [coreMigration]);
    if (!existsSync(databasePath))
        return migrateNewDatabase(databasePath, migrations);
    let db = openCampaignDatabase(databasePath);
    let backupPath;
    try {
        const pending = pendingMigrations(db, migrations);
        if (pending.length === 0)
            return { appliedVersions: [], backupPath: undefined };
        checkpointCampaignDatabase(db);
        verifyDatabase(db);
        db.close();
        backupPath = createPreMigrationBackup(databasePath);
        db = openCampaignDatabase(databasePath);
        const appliedVersions = applyMigrations(db, pending);
        verifyDatabase(db);
        checkpointCampaignDatabase(db);
        return { appliedVersions, backupPath };
    }
    catch (error) {
        if (db.isOpen)
            db.close();
        if (backupPath !== undefined) {
            try {
                restorePreMigrationBackup(databasePath, backupPath);
            }
            catch (restoreError) {
                throw new MigrationFailure("DATABASE_MIGRATION_AND_RESTORE_FAILED", backupPath, {
                    migrationError: error,
                    restoreError,
                });
            }
        }
        throw new MigrationFailure("DATABASE_MIGRATION_FAILED", backupPath, error);
    }
    finally {
        if (db.isOpen)
            db.close();
    }
}
//# sourceMappingURL=migrations.js.map