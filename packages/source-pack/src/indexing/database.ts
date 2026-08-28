import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(new URL("../../migrations/001-source-pack.sql", import.meta.url), "utf8");

export function openSourcePackForBuild(path: string): DatabaseSync {
  if (path.trim().length === 0) throw new Error("SOURCE_DATABASE_PATH_REQUIRED");
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(migration);
    return db;
  } catch (error) { db.close(); throw error; }
}

export function openSourcePackReadOnly(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec("PRAGMA query_only=ON");
    assertSourcePackIntegrity(db);
    return db;
  } catch (error) { db.close(); throw error; }
}

export function assertSourcePackIntegrity(db: DatabaseSync): void {
  const integrity = db.prepare("PRAGMA integrity_check").get() as { integrity_check?: unknown } | undefined;
  if (integrity?.integrity_check !== "ok") throw new Error("SOURCE_DATABASE_INTEGRITY_FAILED");
  if (db.prepare("PRAGMA foreign_key_check").all().length > 0) throw new Error("SOURCE_DATABASE_FOREIGN_KEY_FAILED");
}
