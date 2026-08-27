import { DatabaseSync } from "node:sqlite";
export const CAMPAIGN_DATABASE_BUSY_TIMEOUT_MS = 5_000;
function pragmaNumber(db, sql, key) {
    const row = db.prepare(sql).get();
    const value = row?.[key];
    if (typeof value !== "number")
        throw new Error(`DATABASE_PRAGMA_VERIFICATION_FAILED:${key}`);
    return value;
}
export function openCampaignDatabase(path) {
    if (path.trim().length === 0)
        throw new Error("DATABASE_PATH_REQUIRED");
    const db = new DatabaseSync(path);
    try {
        db.exec("PRAGMA foreign_keys = ON");
        if (pragmaNumber(db, "PRAGMA foreign_keys", "foreign_keys") !== 1) {
            throw new Error("FOREIGN_KEYS_NOT_ENABLED");
        }
        db.exec(`PRAGMA busy_timeout = ${CAMPAIGN_DATABASE_BUSY_TIMEOUT_MS}`);
        if (pragmaNumber(db, "PRAGMA busy_timeout", "timeout") !== CAMPAIGN_DATABASE_BUSY_TIMEOUT_MS) {
            throw new Error("BUSY_TIMEOUT_NOT_ENABLED");
        }
        if (path !== ":memory:") {
            const row = db.prepare("PRAGMA journal_mode = WAL").get();
            if (typeof row?.journal_mode !== "string" || row.journal_mode.toLowerCase() !== "wal") {
                throw new Error("WAL_NOT_ENABLED");
            }
        }
        return db;
    }
    catch (error) {
        db.close();
        throw error;
    }
}
export function verifyDatabase(db) {
    const integrity = db.prepare("PRAGMA integrity_check").get();
    if (integrity?.integrity_check !== "ok")
        throw new Error("DATABASE_INTEGRITY_CHECK_FAILED");
    const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyViolations.length > 0)
        throw new Error("DATABASE_FOREIGN_KEY_CHECK_FAILED");
}
export function checkpointCampaignDatabase(db) {
    const busyTimeout = pragmaNumber(db, "PRAGMA busy_timeout", "timeout");
    let result;
    db.exec("PRAGMA busy_timeout = 0");
    try {
        result = db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
    }
    finally {
        db.exec(`PRAGMA busy_timeout = ${busyTimeout}`);
    }
    if (typeof result?.busy !== "number"
        || typeof result.log !== "number"
        || typeof result.checkpointed !== "number") {
        throw new Error("WAL_CHECKPOINT_VERIFICATION_FAILED");
    }
    if (result.busy !== 0 || result.log !== 0)
        throw new Error("WAL_CHECKPOINT_BUSY");
}
//# sourceMappingURL=database.js.map