import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openCampaignDatabase, runMigrationsWithBackup, } from "@third-chair/storage";
import { createTempDatabase } from "./fixtures.js";
describe("campaign database migrations", () => {
    it("enables and verifies foreign keys, WAL, and a finite busy timeout", () => {
        const temp = createTempDatabase();
        try {
            expect(temp.db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
            expect(temp.db.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
            const timeout = temp.db.prepare("PRAGMA busy_timeout").get();
            expect(timeout.timeout).toBeGreaterThan(0);
            expect(timeout.timeout).toBeLessThanOrEqual(30_000);
        }
        finally {
            temp.close();
            temp.cleanup();
        }
    });
    it("creates the exact core tables and indexes once", () => {
        const temp = createTempDatabase();
        try {
            runMigrationsWithBackup(temp.path);
            const tables = temp.db
                .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
                .all()
                .map((row) => row.name);
            expect(tables).toEqual([
                "active_turns",
                "branches",
                "campaigns",
                "schema_migrations",
                "sqlite_sequence",
                "turn_events",
                "turn_recovery_commands",
                "turns",
            ]);
            const indexes = temp.db
                .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name")
                .all()
                .map((row) => row.name);
            expect(indexes).toEqual([
                "recovery_commands_turn_idx",
                "turn_events_turn_idx",
                "turns_campaign_status_idx",
            ]);
            expect(temp.db.prepare("SELECT version FROM schema_migrations").all()).toEqual([{ version: 1 }]);
        }
        finally {
            temp.close();
            temp.cleanup();
        }
    });
    it("backs up an existing file database before applying a pending migration", () => {
        const temp = createTempDatabase();
        const migration = {
            version: 2,
            name: "add_marker",
            sql: "CREATE TABLE migration_marker (value TEXT NOT NULL);",
        };
        try {
            temp.close();
            const result = runMigrationsWithBackup(temp.path, { migrations: [migration] });
            expect(result.appliedVersions).toEqual([2]);
            expect(result.backupPath).toBeDefined();
            expect(existsSync(result.backupPath)).toBe(true);
            const reopened = openCampaignDatabase(temp.path);
            expect(reopened.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
            expect(reopened.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([
                { version: 1 },
                { version: 2 },
            ]);
            reopened.close();
        }
        finally {
            temp.cleanup();
        }
    });
});
//# sourceMappingURL=migrations.test.js.map