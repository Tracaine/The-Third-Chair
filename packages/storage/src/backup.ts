import { randomUUID } from "node:crypto";
import {
  constants,
  copyFileSync,
  existsSync,
  renameSync,
  rmSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, basename, join } from "node:path";
import {
  checkpointCampaignDatabase,
  openCampaignDatabase,
  verifyDatabase,
} from "./database.js";

function backupTimestamp(now: Date): string {
  return now.toISOString().replaceAll("-", "").replaceAll(":", "");
}

function validateDatabaseFile(path: string): void {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    verifyDatabase(db);
  } catch (error) {
    throw new Error("BACKUP_VALIDATION_FAILED", { cause: error });
  } finally {
    db?.close();
  }
}

function clearSidecars(path: string): void {
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
}

export function createPreMigrationBackup(databasePath: string): string {
  if (!existsSync(databasePath)) throw new Error("DATABASE_NOT_FOUND");

  const db = openCampaignDatabase(databasePath);
  try {
    checkpointCampaignDatabase(db);
    verifyDatabase(db);
  } finally {
    db.close();
  }

  const backupPath = `${databasePath}.pre-migration-${backupTimestamp(new Date())}-${randomUUID()}.bak`;
  copyFileSync(databasePath, backupPath, constants.COPYFILE_EXCL);
  try {
    validateDatabaseFile(backupPath);
    clearSidecars(backupPath);
    return backupPath;
  } catch (error) {
    rmSync(backupPath, { force: true });
    clearSidecars(backupPath);
    throw error;
  }
}

export function restorePreMigrationBackup(databasePath: string, backupPath: string): void {
  validateDatabaseFile(backupPath);
  clearSidecars(backupPath);
  const restoreStage = join(
    dirname(databasePath),
    `.${basename(databasePath)}.${randomUUID()}.restore`,
  );
  try {
    copyFileSync(backupPath, restoreStage, constants.COPYFILE_EXCL);
    validateDatabaseFile(restoreStage);
    clearSidecars(databasePath);
    renameSync(restoreStage, databasePath);
    clearSidecars(databasePath);
    validateDatabaseFile(databasePath);
    clearSidecars(databasePath);
  } finally {
    rmSync(restoreStage, { force: true });
    clearSidecars(restoreStage);
  }
}
