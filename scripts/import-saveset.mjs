#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

if (process.env.THIRD_CHAIR_TSX_BOOTSTRAPPED !== "1") {
  const child = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, THIRD_CHAIR_TSX_BOOTSTRAPPED: "1" },
  });
  process.exit(child.status ?? 1);
}

function usage() {
  return "Usage: node scripts/import-saveset.mjs <archive.zip> --database <destination.sqlite> --source-pack <source-pack.sqlite> [--apply]";
}

function parseArgs(argv) {
  let archivePath;
  let databasePath = process.env.THIRD_CHAIR_DATABASE;
  let sourcePackPath = process.env.THIRD_CHAIR_SOURCE_PACK_DATABASE;
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") { apply = true; continue; }
    if (argument === "--database" || argument === "--source-pack") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error("IMPORT_ARGUMENT_VALUE_REQUIRED");
      if (argument === "--database") databasePath = value;
      else sourcePackPath = value;
      continue;
    }
    if (argument.startsWith("--")) throw new Error(`IMPORT_UNKNOWN_ARGUMENT:${argument}`);
    if (archivePath !== undefined) throw new Error("IMPORT_EXACTLY_ONE_ARCHIVE_REQUIRED");
    archivePath = argument;
  }
  if (!archivePath) throw new Error("IMPORT_ARCHIVE_REQUIRED");
  if (!databasePath) throw new Error("IMPORT_DATABASE_REQUIRED");
  if (!sourcePackPath) throw new Error("IMPORT_SOURCE_PACK_REQUIRED");
  return { archivePath: resolve(archivePath), databasePath: resolve(databasePath), sourcePackPath: resolve(sourcePackPath), apply };
}

function assertExistingDestinationEmpty(databasePath, campaignId, createCampaignArchiveRepository) {
  if (!existsSync(databasePath)) return;
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    db.exec("PRAGMA query_only=ON");
    createCampaignArchiveRepository(db).assertEmptyForRestore(campaignId);
  } finally {
    db.close();
  }
}

async function main() {
  const { createCampaignArchiveRepository, openCampaignDatabase, runMigrationsWithBackup } = await import("@third-chair/storage");
  const { importFullPrivateSaveSet, validateFullPrivateSaveSet } = await import("@third-chair/engine");
  const { createSqliteSourcePackService, openSourcePackReadOnly } = await import("@third-chair/source-pack");
  const options = parseArgs(process.argv.slice(2));
  const archive = readFileSync(options.archivePath);
  const sourceDb = openSourcePackReadOnly(options.sourcePackPath);
  let sourcePackManifestHash;
  try {
    sourcePackManifestHash = createSqliteSourcePackService(sourceDb).manifest().sourcePackManifestHash;
  } finally {
    sourceDb.close();
  }
  if (typeof sourcePackManifestHash !== "string") throw new Error("SOURCE_PACK_MANIFEST_HASH_MISSING");

  // Complete archive/source identity validation precedes every destination write.
  const validated = validateFullPrivateSaveSet({ archive, expectedSourcePackManifestHash: sourcePackManifestHash });
  assertExistingDestinationEmpty(options.databasePath, validated.campaignId, createCampaignArchiveRepository);
  if (!options.apply) {
    process.stdout.write(`${JSON.stringify({ status: "VALID", applied: false,
      campaignId: validated.campaignId, stateVersion: validated.stateVersion, stateHash: validated.stateHash })}\n`);
    return;
  }

  runMigrationsWithBackup(options.databasePath);
  const destinationDb = openCampaignDatabase(options.databasePath);
  try {
    const restored = importFullPrivateSaveSet({ archive, expectedSourcePackManifestHash: sourcePackManifestHash,
      destination: createCampaignArchiveRepository(destinationDb), apply: true });
    process.stdout.write(`${JSON.stringify({ status: "RESTORED", applied: true,
      campaignId: restored.campaignId, stateVersion: restored.stateVersion, stateHash: restored.stateHash })}\n`);
  } finally {
    destinationDb.close();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "IMPORT_FAILED";
  process.stderr.write(`${message}\n${usage()}\n`);
  process.exitCode = 1;
}
