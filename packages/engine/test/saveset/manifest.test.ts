import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SAVESET_MANIFEST_FILENAME,
  SaveSetManifestSchema,
  saveSetPayloadMemberPaths,
  type SaveSetMode,
} from "@third-chair/contracts";
import {
  createSaveSetManifest,
  verifySaveSetManifestMembers,
  type SaveSetContentMember,
} from "@third-chair/engine";

const encoder = new TextEncoder();

function payloadMembers(mode: SaveSetMode): SaveSetContentMember[] {
  return saveSetPayloadMemberPaths(mode).map((path, index) => ({
    path,
    bytes: encoder.encode(`${path}:${index}`),
  }));
}

function manifestFor(mode: SaveSetMode = "PLAYER_SAFE") {
  return createSaveSetManifest({
    mode,
    campaignId: "test_campaign_saveset",
    campaignName: "The Ashen Road",
    stateVersion: 7,
    stateHash: "a".repeat(64),
    sourcePackManifestHash: "b".repeat(64),
    activeBranchId: "test_branch_saveset",
    createdAt: "2026-09-07T12:00:00.000Z",
    members: payloadMembers(mode),
  });
}

describe("SaveSet manifest primitives", () => {
  it("builds mode-exact hashes and uncompressed byte counts", () => {
    const members = payloadMembers("FULL_PRIVATE");
    const manifest = createSaveSetManifest({
      mode: "FULL_PRIVATE",
      campaignId: "test_campaign_saveset",
      campaignName: "The Ashen Road",
      stateVersion: 7,
      stateHash: "a".repeat(64),
      sourcePackManifestHash: "b".repeat(64),
      activeBranchId: "test_branch_saveset",
      createdAt: "2026-09-07T12:00:00.000Z",
      members,
    });

    expect(SaveSetManifestSchema.parse(manifest)).toEqual(manifest);
    expect(manifest.members.map(({ path }) => path)).toEqual([...saveSetPayloadMemberPaths("FULL_PRIVATE")].sort());
    expect(manifest.members).not.toContainEqual(expect.objectContaining({ path: SAVESET_MANIFEST_FILENAME }));

    const worldState = members.find(({ path }) => path === "private/world-state.json")!;
    expect(manifest.members.find(({ path }) => path === worldState.path)).toEqual({
      path: worldState.path,
      sha256: createHash("sha256").update(worldState.bytes).digest("hex"),
      uncompressedBytes: worldState.bytes.byteLength,
    });
  });

  it("rejects missing and unexpected manifest members", () => {
    const manifest = manifestFor();
    expect(SaveSetManifestSchema.safeParse({ ...manifest, members: manifest.members.slice(1) }).success).toBe(false);
    expect(SaveSetManifestSchema.safeParse({
      ...manifest,
      members: [...manifest.members, {
        path: "private/rng.json",
        sha256: "c".repeat(64),
        uncompressedBytes: 1,
      }],
    }).success).toBe(false);
  });

  it("never permits a manifest self-checksum", () => {
    const members = payloadMembers("PLAYER_SAFE");
    expect(() => createSaveSetManifest({
      mode: "PLAYER_SAFE",
      campaignId: "test_campaign_saveset",
      campaignName: "The Ashen Road",
      stateVersion: 7,
      stateHash: "a".repeat(64),
      sourcePackManifestHash: "b".repeat(64),
      activeBranchId: "test_branch_saveset",
      createdAt: "2026-09-07T12:00:00.000Z",
      members: [...members, { path: SAVESET_MANIFEST_FILENAME, bytes: encoder.encode("manifest") }],
    })).toThrow("SAVESET_MANIFEST_SELF_CHECKSUM");
  });

  it("verifies declared member hashes and sizes", () => {
    const manifest = manifestFor();
    const members = payloadMembers("PLAYER_SAFE");

    expect(verifySaveSetManifestMembers(manifest, members)).toEqual(manifest);

    const equalLengthTamper = members.map((member) => {
      if (member.path !== "characters.json") return member;
      const bytes = new Uint8Array(member.bytes);
      bytes[0] = bytes[0]! ^ 0x01;
      return { ...member, bytes };
    });
    expect(() => verifySaveSetManifestMembers(manifest, equalLengthTamper))
      .toThrow("SAVESET_MANIFEST_MEMBER_HASH_MISMATCH:characters.json");

    expect(() => verifySaveSetManifestMembers(manifest, members.map((member) => (
      member.path === "characters.json" ? { ...member, bytes: encoder.encode("tampered") } : member
    )))).toThrow("SAVESET_MANIFEST_MEMBER_SIZE_MISMATCH:characters.json");

    const wrongSize = {
      ...manifest,
      members: manifest.members.map((member) => (
        member.path === "journal.md" ? { ...member, uncompressedBytes: member.uncompressedBytes + 1 } : member
      )),
    };
    expect(() => verifySaveSetManifestMembers(wrongSize, members))
      .toThrow("SAVESET_MANIFEST_MEMBER_SIZE_MISMATCH:journal.md");
  });
});
