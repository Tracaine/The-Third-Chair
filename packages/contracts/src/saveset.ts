import { z } from "zod";
import { PersistedIdSchema } from "./ids.js";

export const SAVESET_SCHEMA_VERSION = 1 as const;
export const SAVESET_MANIFEST_FILENAME = "manifest.json" as const;
export const SAVESET_MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
export const SAVESET_MAX_MEMBER_BYTES = 50 * 1024 * 1024;

export const SaveSetModeSchema = z.enum(["PLAYER_SAFE", "FULL_PRIVATE"]);

export const CommonSaveSetPayloadMemberPaths = [
  "characters.json",
  "journal.md",
  "rulings.json",
  "citations.json",
  "branches.json",
] as const;

export const PlayerSafeSaveSetPayloadMemberPaths = [
  ...CommonSaveSetPayloadMemberPaths,
  "player-view.json",
  "visible-turn-summaries.json",
] as const;

export const FullPrivateSaveSetPayloadMemberPaths = [
  ...CommonSaveSetPayloadMemberPaths,
  "private/world-state.json",
  "private/rng.json",
  "private/turns.jsonl",
  "private/checkpoints.json",
  "private/creation.json",
] as const;

const SaveSetPayloadMemberPathValues = [
  ...PlayerSafeSaveSetPayloadMemberPaths,
  "private/world-state.json",
  "private/rng.json",
  "private/turns.jsonl",
  "private/checkpoints.json",
  "private/creation.json",
] as const;

const SaveSetArchiveMemberPathValues = [
  SAVESET_MANIFEST_FILENAME,
  ...SaveSetPayloadMemberPathValues,
] as const;

export const SaveSetPayloadMemberPathSchema = z.enum(SaveSetPayloadMemberPathValues);
export const SaveSetArchiveMemberPathSchema = z.enum(SaveSetArchiveMemberPathValues);
export const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);

export function saveSetPayloadMemberPaths(mode: SaveSetMode): readonly SaveSetPayloadMemberPath[] {
  return mode === "PLAYER_SAFE"
    ? PlayerSafeSaveSetPayloadMemberPaths
    : FullPrivateSaveSetPayloadMemberPaths;
}

export function saveSetArchiveMemberPaths(mode: SaveSetMode): readonly SaveSetArchiveMemberPath[] {
  return [SAVESET_MANIFEST_FILENAME, ...saveSetPayloadMemberPaths(mode)];
}

export const SaveSetManifestMemberSchema = z.object({
  path: SaveSetPayloadMemberPathSchema,
  sha256: Sha256HexSchema,
  uncompressedBytes: z.number().int().nonnegative().max(SAVESET_MAX_MEMBER_BYTES),
}).strict();

const CampaignNameSchema = z.string().trim().min(1).max(200);
const UtcTimestampSchema = z.string().datetime({ offset: false }).refine((value) => value.endsWith("Z"), {
  message: "Expected UTC timestamp",
});

export const SaveSetManifestSchema = z.object({
  schemaVersion: z.literal(SAVESET_SCHEMA_VERSION),
  mode: SaveSetModeSchema,
  campaignId: PersistedIdSchema,
  campaignName: CampaignNameSchema,
  stateVersion: z.number().int().nonnegative(),
  stateHash: Sha256HexSchema,
  sourcePackManifestHash: Sha256HexSchema,
  activeBranchId: PersistedIdSchema,
  createdAt: UtcTimestampSchema,
  members: z.array(SaveSetManifestMemberSchema),
}).strict().superRefine((manifest, context) => {
  const required = new Set(saveSetPayloadMemberPaths(manifest.mode));
  const seen = new Set<string>();

  for (const [index, member] of manifest.members.entries()) {
    if (seen.has(member.path)) {
      context.addIssue({
        code: "custom",
        path: ["members", index, "path"],
        message: "SAVESET_MANIFEST_DUPLICATE_MEMBER",
      });
      continue;
    }
    seen.add(member.path);
    if (!required.has(member.path)) {
      context.addIssue({
        code: "custom",
        path: ["members", index, "path"],
        message: "SAVESET_MANIFEST_UNEXPECTED_MEMBER",
      });
    }
  }

  for (const path of required) {
    if (!seen.has(path)) {
      context.addIssue({
        code: "custom",
        path: ["members"],
        message: `SAVESET_MANIFEST_MISSING_MEMBER:${path}`,
      });
    }
  }
});

export const ExportCampaignInputSchema = z.object({
  campaignId: PersistedIdSchema,
  expectedStateVersion: z.number().int().nonnegative(),
  requestId: PersistedIdSchema,
  mode: SaveSetModeSchema,
  confirmedSpoilers: z.boolean(),
}).strict();

export const ExportCampaignOutputSchema = z.object({
  exportId: PersistedIdSchema,
  uri: z.string().regex(/^third-chair:\/\/exports\/(?:test_[a-z0-9_]+|[0-9a-fA-F-]{36})$/),
  mimeType: z.literal("application/zip"),
  sizeBytes: z.number().int().nonnegative(),
  sha256: Sha256HexSchema,
  expiresAt: UtcTimestampSchema,
}).strict();

export type SaveSetMode = z.infer<typeof SaveSetModeSchema>;
export type SaveSetPayloadMemberPath = z.infer<typeof SaveSetPayloadMemberPathSchema>;
export type SaveSetArchiveMemberPath = z.infer<typeof SaveSetArchiveMemberPathSchema>;
export type SaveSetManifestMember = z.infer<typeof SaveSetManifestMemberSchema>;
export type SaveSetManifest = z.infer<typeof SaveSetManifestSchema>;
export type ExportCampaignInput = z.infer<typeof ExportCampaignInputSchema>;
export type ExportCampaignOutput = z.infer<typeof ExportCampaignOutputSchema>;
