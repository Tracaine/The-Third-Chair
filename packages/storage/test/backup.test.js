import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPreMigrationBackup, openCampaignDatabase, restorePreMigrationBackup, runMigrationsWithBackup, } from "@third-chair/storage";
import { createTempDatabase } from "./fixtures.js";
describe("pre-migration backup and restore", () => {
    it("refuses to back up while a reader prevents a complete WAL checkpoint", () => {
        const temp = createTempDatabase();
        const reader = openCampaignDatabase(temp.path);
        try {
            temp.db.exec("CREATE TABLE checkpoint_value (value TEXT NOT NULL); INSERT INTO checkpoint_value VALUES ('before');");
            temp.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
            reader.exec("BEGIN");
            expect(reader.prepare("SELECT value FROM checkpoint_value").get()).toEqual({ value: "before" });
            temp.db.exec("INSERT INTO checkpoint_value VALUES ('pending')");
            expect(() => createPreMigrationBackup(temp.path)).toThrow("WAL_CHECKPOINT_BUSY");
        }
        finally {
            if (reader.isTransaction)
                reader.exec("ROLLBACK");
            reader.close();
            temp.close();
            temp.cleanup();
        }
    }, 10_000);
    it("creates a validated timestamped backup and restores its exact bytes while clearing sidecars", () => {
        const temp = createTempDatabase();
        try {
            temp.db.exec("CREATE TABLE durable_value (value TEXT NOT NULL); INSERT INTO durable_value VALUES ('before');");
            temp.close();
            const backupPath = createPreMigrationBackup(temp.path);
            expect(backupPath).toMatch(/\.pre-migration-\d{8}T\d{6}\.\d{3}Z-[0-9a-f-]+\.bak$/);
            expect(existsSync(backupPath)).toBe(true);
            const changed = openCampaignDatabase(temp.path);
            changed.exec("UPDATE durable_value SET value = 'after'");
            changed.close();
            writeFileSync(`${temp.path}-wal`, "stale wal");
            writeFileSync(`${temp.path}-shm`, "stale shm");
            restorePreMigrationBackup(temp.path, backupPath);
            expect(readFileSync(temp.path).equals(readFileSync(backupPath))).toBe(true);
            expect(existsSync(`${temp.path}-wal`)).toBe(false);
            expect(existsSync(`${temp.path}-shm`)).toBe(false);
            const restored = openCampaignDatabase(temp.path);
            expect(restored.prepare("SELECT value FROM durable_value").get()).toEqual({ value: "before" });
            restored.close();
        }
        finally {
            temp.cleanup();
        }
    });
    it("rejects a corrupt backup before replacing the live database", () => {
        const temp = createTempDatabase();
        try {
            temp.close();
            const original = readFileSync(temp.path);
            const corrupt = join(temp.directory, "corrupt.bak");
            writeFileSync(corrupt, "not sqlite");
            expect(() => restorePreMigrationBackup(temp.path, corrupt)).toThrow("BACKUP_VALIDATION_FAILED");
            expect(readFileSync(temp.path).equals(original)).toBe(true);
        }
        finally {
            temp.cleanup();
        }
    });
    it("restores the validated pre-migration image after an injected migration fails", () => {
        const temp = createTempDatabase();
        const failing = [
            { version: 2, name: "durable_data", sql: "CREATE TABLE durable_data (value TEXT); INSERT INTO durable_data VALUES ('mutated');" },
            { version: 3, name: "fail", sql: "INSERT INTO table_that_does_not_exist VALUES (1);" },
        ];
        try {
            temp.db.exec("CREATE TABLE original_data (value TEXT NOT NULL); INSERT INTO original_data VALUES ('original');");
            temp.close();
            let backupPath;
            try {
                runMigrationsWithBackup(temp.path, { migrations: failing });
            }
            catch (error) {
                backupPath = error.backupPath;
            }
            expect(backupPath).toBeDefined();
            expect(readFileSync(temp.path).equals(readFileSync(backupPath))).toBe(true);
            const restored = openCampaignDatabase(temp.path);
            expect(restored.prepare("SELECT value FROM original_data").get()).toEqual({ value: "original" });
            expect(restored.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([{ version: 1 }]);
            expect(() => restored.prepare("SELECT * FROM durable_data").all()).toThrow();
            restored.close();
        }
        finally {
            temp.cleanup();
        }
    });
    it("does not publish a partially migrated new database", () => {
        const temp = createTempDatabase();
        try {
            temp.close();
            const newPath = join(temp.directory, "new.sqlite");
            const failing = {
                version: 1,
                name: "fail_new",
                sql: "CREATE TABLE partial (value TEXT); INSERT INTO missing_table VALUES (1);",
            };
            expect(() => runMigrationsWithBackup(newPath, { migrations: [failing] })).toThrow();
            expect(existsSync(newPath)).toBe(false);
        }
        finally {
            temp.cleanup();
        }
    });
});
//# sourceMappingURL=backup.test.js.map