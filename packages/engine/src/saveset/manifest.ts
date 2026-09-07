import { createHash } from "node:crypto";
import {
  SAVESET_SCHEMA_VERSION,
  SAVESET_MANIFEST_FILENAME,
  SaveSetManifestSchema,
  type SaveSetManifest,
  type SaveSetMode,
  saveSetPayloadMemberPaths,
} from "@third-chair/contracts";
import { normalizeArchivePath } from "./zip.js";

export interface SaveSetContentMember {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface CreateSaveSetManifestInput {
  readonly mode: SaveSetMode;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly stateVersion: number;
  readonly stateHash: string;
  readonly sourcePackManifestHash: string;
  readonly activeBranchId: string;
  readonly createdAt: string;
  /** Every required non-manifest member for the requested mode. */
  readonly members: readonly SaveSetContentMember[];
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifestError(code: string): Error {
  return new Error(code);
}

function collectPayloadMembers(
  mode: SaveSetMode,
  rawMembers: readonly SaveSetContentMember[],
): Map<string, Uint8Array> {
  if (!Array.isArray(rawMembers)) throw manifestError("SAVESET_MANIFEST_MEMBERS_INVALID");

  const expected = new Set<string>(saveSetPayloadMemberPaths(mode));
  const normalized = new Map<string, Uint8Array>();
  const caseFolded = new Map<string, string>();

  for (const rawMember of rawMembers) {
    if (rawMember === null || typeof rawMember !== "object") {
      throw manifestError("SAVESET_MANIFEST_MEMBER_INVALID");
    }
    const member = rawMember as SaveSetContentMember;
    if (typeof member.path !== "string" || !(member.bytes instanceof Uint8Array)) {
      throw manifestError("SAVESET_MANIFEST_MEMBER_INVALID");
    }

    const path = normalizeArchivePath(member.path);
    if (path === SAVESET_MANIFEST_FILENAME) throw manifestError("SAVESET_MANIFEST_SELF_CHECKSUM");
    if (normalized.has(path)) throw manifestError("SAVESET_MANIFEST_DUPLICATE_MEMBER");

    const folded = path.toLowerCase();
    if (caseFolded.has(folded)) throw manifestError("SAVESET_MANIFEST_CASE_COLLISION");
    if (!expected.has(path)) throw manifestError("SAVESET_MANIFEST_UNEXPECTED_MEMBER");

    normalized.set(path, member.bytes);
    caseFolded.set(folded, path);
  }

  for (const path of expected) {
    if (!normalized.has(path)) throw manifestError(`SAVESET_MANIFEST_MISSING_MEMBER:${path}`);
  }

  return normalized;
}

export function createSaveSetManifest(input: CreateSaveSetManifestInput): SaveSetManifest {
  const payloadMembers = collectPayloadMembers(input.mode, input.members);
  const members = [...payloadMembers.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, bytes]) => ({ path, sha256: sha256Bytes(bytes), uncompressedBytes: bytes.byteLength }));

  return SaveSetManifestSchema.parse({
    schemaVersion: SAVESET_SCHEMA_VERSION,
    mode: input.mode,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    stateVersion: input.stateVersion,
    stateHash: input.stateHash,
    sourcePackManifestHash: input.sourcePackManifestHash,
    activeBranchId: input.activeBranchId,
    createdAt: input.createdAt,
    members,
  });
}

/** Alias kept for callers that describe this primitive as manifest construction. */
export const buildSaveSetManifest = createSaveSetManifest;

/**
 * Verifies the exact non-manifest payload set against an already parsed manifest.
 * ZIP extraction remains deliberately separate from this pure integrity primitive.
 */
export function verifySaveSetManifestMembers(
  rawManifest: unknown,
  rawMembers: readonly SaveSetContentMember[],
): SaveSetManifest {
  const manifest = SaveSetManifestSchema.parse(rawManifest);
  const payloadMembers = collectPayloadMembers(manifest.mode, rawMembers);
  const manifestMembers = new Map<string, SaveSetManifest["members"][number]>();
  for (const member of manifest.members) manifestMembers.set(member.path, member);

  for (const [path, bytes] of payloadMembers) {
    const declared = manifestMembers.get(path);
    if (declared === undefined) throw manifestError("SAVESET_MANIFEST_MISSING_MEMBER");
    if (declared.uncompressedBytes !== bytes.byteLength) {
      throw manifestError(`SAVESET_MANIFEST_MEMBER_SIZE_MISMATCH:${path}`);
    }
    if (declared.sha256 !== sha256Bytes(bytes)) {
      throw manifestError(`SAVESET_MANIFEST_MEMBER_HASH_MISMATCH:${path}`);
    }
  }

  return manifest;
}
