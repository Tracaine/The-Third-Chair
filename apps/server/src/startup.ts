import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { SourcePackService } from "@third-chair/contracts";
import {
  openCampaignDatabase,
  restorePreMigrationBackup,
  runMigrationsWithBackup,
} from "@third-chair/storage";
import {
  createSqliteSourcePackService,
  openSourcePackReadOnly,
} from "@third-chair/source-pack";
import { readConfig } from "./config.js";
import {
  DEFAULT_CAMPAIGN_DATABASE_PATH,
  DEFAULT_EXPORT_DIRECTORY,
  DEFAULT_SOURCE_PACK_DATABASE_PATH,
  DEFAULT_WIDGET_BUILD_PATH,
} from "./project-paths.js";
import { loadWidgetResource, type WidgetResource } from "./mcp/widget-resource.js";

export type StartupStatus = "ready" | "degraded";
export type RecoveryCode = "SOURCE_PACK_UNAVAILABLE" | "SOURCE_PACK_HASH_MISMATCH";

export interface StartupResult {
  readonly status: StartupStatus;
  readonly recoveryCode?: RecoveryCode;
  readonly databasePath: string;
  readonly exportDirectory: string;
  readonly db: DatabaseSync;
  readonly sourcePack: SourcePackService | null;
  readonly sourcePackDatabase: DatabaseSync | null;
  readonly widgetResource: WidgetResource;
}

export class StartupFailure extends Error {
  constructor(readonly code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "StartupFailure";
  }
}

function configuredPath(value: string | undefined, fallback: string): string {
  const path = resolve(value ?? fallback);
  if (path.trim().length === 0) throw new StartupFailure("INVALID_RUNTIME_PATH");
  return path;
}

function verifyWritableDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
  const probe = join(path, `.third-chair-write-${process.pid}-${randomUUID()}`);
  let handle: number | undefined;
  try {
    handle = openSync(probe, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  } catch (error) {
    throw new StartupFailure("DATA_DIRECTORY_NOT_WRITABLE", { cause: error });
  } finally {
    if (handle !== undefined) closeSync(handle);
    rmSync(probe, { force: true });
  }
}

function enforceTracingPolicy(env: NodeJS.ProcessEnv): void {
  const traceMode = env.THIRD_CHAIR_TRACE_MODE ?? "off";
  if (traceMode !== "off" || env.OPENAI_AGENTS_DISABLE_TRACING === "0") {
    throw new StartupFailure("NORMAL_PLAY_TRACING_FORBIDDEN");
  }
}

function markUnavailableCampaigns(
  db: DatabaseSync,
  sourcePackHash: string | undefined,
): RecoveryCode | undefined {
  if (sourcePackHash === undefined) {
    const result = db.prepare("UPDATE campaigns SET status='READ_ONLY' WHERE status='ACTIVE'").run();
    return Number(result.changes) > 0 ? "SOURCE_PACK_UNAVAILABLE" : undefined;
  }
  const result = db.prepare(
    "UPDATE campaigns SET status='READ_ONLY' WHERE status='ACTIVE' AND source_pack_hash<>?",
  ).run(sourcePackHash);
  return Number(result.changes) > 0 ? "SOURCE_PACK_HASH_MISMATCH" : undefined;
}

function removeNewDatabase(path: string): void {
  rmSync(path, { force: true });
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
}

export function performStartup(env: NodeJS.ProcessEnv = process.env): StartupResult {
  const config = readConfig(env);
  enforceTracingPolicy(env);
  const databasePath = configuredPath(
    env.THIRD_CHAIR_DATABASE ?? env.CAMPAIGN_DB_PATH,
    DEFAULT_CAMPAIGN_DATABASE_PATH,
  );
  const sourcePackPath = configuredPath(
    env.THIRD_CHAIR_SOURCE_PACK_DATABASE ?? env.SOURCE_PACK_DB_PATH,
    DEFAULT_SOURCE_PACK_DATABASE_PATH,
  );
  const exportDirectory = configuredPath(env.THIRD_CHAIR_EXPORT_DIRECTORY, DEFAULT_EXPORT_DIRECTORY);
  const widgetPath = configuredPath(env.THIRD_CHAIR_WIDGET_BUILD, DEFAULT_WIDGET_BUILD_PATH);
  verifyWritableDirectory(dirname(databasePath));
  verifyWritableDirectory(exportDirectory);

  const lockPath = `${databasePath}.startup.lock`;
  let lockHandle: number;
  try {
    lockHandle = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  } catch (error) {
    throw new StartupFailure("STARTUP_ALREADY_RUNNING", { cause: error });
  }

  const databaseExisted = existsSync(databasePath);
  let backupPath: string | undefined;
  let db: DatabaseSync | undefined;
  let sourcePackDatabase: DatabaseSync | null = null;
  try {
    const migration = runMigrationsWithBackup(databasePath);
    backupPath = migration.backupPath;
    let widgetResource: WidgetResource;
    try {
      widgetResource = loadWidgetResource(widgetPath);
    } catch (error) {
      if (backupPath) restorePreMigrationBackup(databasePath, backupPath);
      else if (!databaseExisted) removeNewDatabase(databasePath);
      throw new StartupFailure("WIDGET_BUILD_MISSING", { cause: error });
    }

    db = openCampaignDatabase(databasePath);
    let sourcePack: SourcePackService | null = null;
    let recoveryCode: RecoveryCode | undefined;
    if (!config.fakeMode) {
      try {
        sourcePackDatabase = openSourcePackReadOnly(sourcePackPath);
        sourcePack = createSqliteSourcePackService(sourcePackDatabase);
        const hash = sourcePack.manifest().sourcePackManifestHash;
        if (typeof hash !== "string" || hash.length === 0) throw new Error("SOURCE_PACK_MANIFEST_INVALID");
        recoveryCode = markUnavailableCampaigns(db, hash);
      } catch {
        sourcePackDatabase?.close();
        sourcePackDatabase = null;
        sourcePack = null;
        recoveryCode = markUnavailableCampaigns(db, undefined) ?? "SOURCE_PACK_UNAVAILABLE";
      }
    }
    return {
      status: recoveryCode ? "degraded" : "ready",
      ...(recoveryCode ? { recoveryCode } : {}),
      databasePath,
      exportDirectory,
      db,
      sourcePack,
      sourcePackDatabase,
      widgetResource,
    };
  } catch (error) {
    db?.close();
    if (error instanceof StartupFailure) throw error;
    throw new StartupFailure("STARTUP_PREFLIGHT_FAILED", { cause: error });
  } finally {
    closeSync(lockHandle);
    unlinkSync(lockPath);
  }
}

export function mutationRecoveryGuard(startup: StartupResult) {
  return (toolName: string, input: unknown): void => {
    if (startup.status === "ready") return;
    const payload = input && typeof input === "object" ? input as Record<string, unknown> : {};
    const campaignId = typeof payload.campaignId === "string" ? payload.campaignId : undefined;
    if (startup.recoveryCode === "SOURCE_PACK_UNAVAILABLE") throw new Error("SOURCE_PACK_UNAVAILABLE");
    if (toolName === "create_campaign") {
      const requestedHash = payload.sourcePackHash;
      const availableHash = startup.sourcePack?.manifest().sourcePackManifestHash;
      if (requestedHash !== availableHash) throw new Error("SOURCE_PACK_HASH_MISMATCH");
      return;
    }
    if (campaignId && startup.db.prepare("SELECT status FROM campaigns WHERE id=?").get(campaignId)) {
      const campaign = startup.db.prepare("SELECT status FROM campaigns WHERE id=?").get(campaignId) as { status: string };
      if (campaign.status === "READ_ONLY") throw new Error("SOURCE_PACK_HASH_MISMATCH");
    }
  };
}
