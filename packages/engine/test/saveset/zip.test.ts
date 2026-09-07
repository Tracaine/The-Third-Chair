import { Zip, ZipPassThrough, zipSync, type ZipOptions } from "fflate";
import { describe, expect, it } from "vitest";
import {
  SAVESET_MANIFEST_FILENAME,
  saveSetArchiveMemberPaths,
  type SaveSetMode,
} from "@third-chair/contracts";
import {
  createSaveSetZip,
  extractSaveSetZip,
  normalizeArchivePath,
  type SaveSetZipMember,
} from "@third-chair/engine";

const encoder = new TextEncoder();

function membersFor(mode: SaveSetMode, bytes = (path: string) => encoder.encode(`body:${path}`)): SaveSetZipMember[] {
  return saveSetArchiveMemberPaths(mode).map((path) => ({ path, bytes: bytes(path) }));
}

type ZipCompressionLevel = NonNullable<ZipOptions["level"]>;

function rawZip(members: readonly SaveSetZipMember[], level: ZipCompressionLevel = 6): Uint8Array {
  const files: Record<string, [Uint8Array, { level: ZipCompressionLevel }]> = {};
  for (const member of members) files[member.path] = [member.bytes, { level }];
  return zipSync(files);
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function streamingZip(members: readonly SaveSetZipMember[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let failure: Error | undefined;
  const archive = new Zip((error, chunk) => {
    if (error !== null) {
      failure = error;
      return;
    }
    chunks.push(new Uint8Array(chunk));
  });

  for (const member of members) {
    const file = new ZipPassThrough(member.path);
    archive.add(file);
    file.push(member.bytes, true);
  }
  archive.end();

  if (failure !== undefined) throw failure;
  return concat(chunks);
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8)
    | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function locateEntry(archive: Uint8Array, path: string) {
  const name = encoder.encode(path);
  for (let offset = 0; offset + 46 <= archive.byteLength; offset += 1) {
    if (readU32(archive, offset) !== 0x02014b50) continue;
    const nameBytes = readU16(archive, offset + 28);
    const extraBytes = readU16(archive, offset + 30);
    const commentBytes = readU16(archive, offset + 32);
    if (nameBytes !== name.byteLength) {
      offset += 45 + nameBytes + extraBytes + commentBytes;
      continue;
    }
    const candidate = archive.subarray(offset + 46, offset + 46 + nameBytes);
    if (!candidate.every((byte, index) => byte === name[index])) {
      offset += 45 + nameBytes + extraBytes + commentBytes;
      continue;
    }

    const localOffset = readU32(archive, offset + 42);
    const localNameBytes = readU16(archive, localOffset + 26);
    const localExtraBytes = readU16(archive, localOffset + 28);
    const compressedBytes = readU32(archive, offset + 20);
    return {
      centralOffset: offset,
      localOffset,
      dataOffset: localOffset + 30 + localNameBytes + localExtraBytes,
      compressedBytes,
      flags: readU16(archive, offset + 8),
    };
  }
  throw new Error(`test entry not found: ${path}`);
}

describe("SaveSet ZIP primitives", () => {
  it("round-trips both stored and deflated mode-exact archives", () => {
    for (const level of [0, 6] as const) {
      const members = membersFor("FULL_PRIVATE");
      const archive = level === 6
        ? createSaveSetZip({ mode: "FULL_PRIVATE", members })
        : rawZip(members, level);
      const extracted = extractSaveSetZip({ mode: "FULL_PRIVATE", archive });

      expect(Object.keys(extracted).sort()).toEqual([...saveSetArchiveMemberPaths("FULL_PRIVATE")].sort());
      expect(extracted["private/world-state.json"]).toEqual(members.find(({ path }) => path === "private/world-state.json")!.bytes);
    }
  });

  it("normalizes safe backslash separators to canonical forward-slash paths", () => {
    expect(normalizeArchivePath("private\\world-state.json")).toBe("private/world-state.json");
    const members = membersFor("FULL_PRIVATE").map((member) => (
      member.path === "private/world-state.json" ? { ...member, path: "private\\world-state.json" } : member
    ));
    const extracted = extractSaveSetZip({ mode: "FULL_PRIVATE", archive: createSaveSetZip({ mode: "FULL_PRIVATE", members }) });
    expect(extracted).toHaveProperty("private/world-state.json");
  });

  it("rejects traversal, POSIX, drive, UNC, and backslash-disguised absolute paths", () => {
    const maliciousPaths = [
      "../escape.json",
      "/escape.json",
      "C:\\escape.json",
      "\\\\server\\share\\escape.json",
      "\\absolute\\escape.json",
      "private\\..\\escape.json",
    ];

    for (const path of maliciousPaths) {
      const archive = rawZip([...membersFor("PLAYER_SAFE"), { path, bytes: encoder.encode("nope") }]);
      expect(() => extractSaveSetZip({ mode: "PLAYER_SAFE", archive })).toThrow(/SAVESET_ZIP_(?:PATH_TRAVERSAL|ABSOLUTE_PATH|DRIVE_PATH|UNC_PATH)/);
    }
  });

  it("rejects duplicate normalized names and case collisions", () => {
    const duplicated = streamingZip([
      ...membersFor("FULL_PRIVATE"),
      { path: "private/world-state.json", bytes: encoder.encode("duplicate") },
    ]);
    expect(() => extractSaveSetZip({ mode: "FULL_PRIVATE", archive: duplicated }))
      .toThrow("SAVESET_ZIP_DUPLICATE_MEMBER");

    const normalizedDuplicate = rawZip([
      ...membersFor("FULL_PRIVATE"),
      { path: "private\\world-state.json", bytes: encoder.encode("duplicate") },
    ]);
    expect(() => extractSaveSetZip({ mode: "FULL_PRIVATE", archive: normalizedDuplicate }))
      .toThrow("SAVESET_ZIP_DUPLICATE_MEMBER");

    const caseCollision = rawZip([
      ...membersFor("PLAYER_SAFE"),
      { path: "CHARACTERS.json", bytes: encoder.encode("collision") },
    ]);
    expect(() => extractSaveSetZip({ mode: "PLAYER_SAFE", archive: caseCollision }))
      .toThrow("SAVESET_ZIP_CASE_COLLISION");
  });

  it("rejects directory, missing, and unexpected archive members", () => {
    const directory = rawZip([...membersFor("FULL_PRIVATE"), { path: "private/", bytes: new Uint8Array() }]);
    expect(() => extractSaveSetZip({ mode: "FULL_PRIVATE", archive: directory }))
      .toThrow("SAVESET_ZIP_DIRECTORY_ENTRY");

    const missing = rawZip(membersFor("PLAYER_SAFE").filter(({ path }) => path !== "branches.json"));
    expect(() => extractSaveSetZip({ mode: "PLAYER_SAFE", archive: missing }))
      .toThrow("SAVESET_ZIP_MISSING_MEMBER:branches.json");

    const unexpected = rawZip([...membersFor("PLAYER_SAFE"), { path: "not-a-saveset-member.json", bytes: encoder.encode("nope") }]);
    expect(() => extractSaveSetZip({ mode: "PLAYER_SAFE", archive: unexpected }))
      .toThrow("SAVESET_ZIP_UNEXPECTED_MEMBER");
  });

  it("enforces archive and uncompressed member size limits", () => {
    const oversizedMember = membersFor("PLAYER_SAFE", (path) => encoder.encode(path === SAVESET_MANIFEST_FILENAME ? "m" : "x"))
      .map((member) => member.path === "characters.json" ? { ...member, bytes: encoder.encode("xx") } : member);
    expect(() => createSaveSetZip({
      mode: "PLAYER_SAFE",
      members: oversizedMember,
      limits: { maxMemberBytes: 1 },
    })).toThrow("SAVESET_ZIP_MEMBER_TOO_LARGE:characters.json");

    const archive = rawZip(membersFor("PLAYER_SAFE"));
    expect(() => extractSaveSetZip({
      mode: "PLAYER_SAFE",
      archive,
      limits: { maxArchiveBytes: archive.byteLength - 1 },
    })).toThrow("SAVESET_ZIP_ARCHIVE_TOO_LARGE");

    expect(() => extractSaveSetZip({
      mode: "PLAYER_SAFE",
      archive,
      limits: { maxMemberBytes: 1 },
    })).toThrow(/SAVESET_ZIP_MEMBER_TOO_LARGE/);
  });

  it("enforces the streaming size limit when declared size is forged smaller", () => {
    const archive = rawZip(membersFor(
      "PLAYER_SAFE",
      (path) => path === "characters.json" ? encoder.encode("xx") : encoder.encode("x"),
    ), 0);
    const forged = new Uint8Array(archive);
    const entry = locateEntry(forged, "characters.json");

    writeU32(forged, entry.centralOffset + 24, 1);
    writeU32(forged, entry.localOffset + 22, 1);

    expect(() => extractSaveSetZip({
      mode: "PLAYER_SAFE",
      archive: forged,
      limits: { maxMemberBytes: 1 },
    })).toThrow("SAVESET_ZIP_MEMBER_TOO_LARGE:characters.json");
  });

  it("verifies CRC-32 against the actual extracted member bytes", () => {
    const archive = rawZip(membersFor("PLAYER_SAFE"), 0);
    const corrupted = new Uint8Array(archive);
    const entry = locateEntry(corrupted, "characters.json");
    corrupted[entry.dataOffset] = corrupted[entry.dataOffset]! ^ 0x01;

    expect(() => extractSaveSetZip({ mode: "PLAYER_SAFE", archive: corrupted }))
      .toThrow("SAVESET_ZIP_CRC_MISMATCH:characters.json");
  });

  it("rejects inconsistent central and local CRC metadata", () => {
    const archive = rawZip(membersFor("PLAYER_SAFE"), 0);
    const inconsistent = new Uint8Array(archive);
    const entry = locateEntry(inconsistent, "characters.json");
    writeU32(
      inconsistent,
      entry.localOffset + 14,
      readU32(inconsistent, entry.localOffset + 14) ^ 0x01,
    );

    expect(() => extractSaveSetZip({ mode: "PLAYER_SAFE", archive: inconsistent }))
      .toThrow("SAVESET_ZIP_MALFORMED");
  });

  it("accepts valid data descriptors and rejects descriptor corruption", () => {
    const archive = streamingZip(membersFor("PLAYER_SAFE"));
    expect(extractSaveSetZip({ mode: "PLAYER_SAFE", archive }))
      .toHaveProperty("characters.json");

    const corrupted = new Uint8Array(archive);
    const entry = locateEntry(corrupted, "characters.json");
    expect(entry.flags & 0x0008).not.toBe(0);

    let descriptorOffset = entry.dataOffset + entry.compressedBytes;
    if (readU32(corrupted, descriptorOffset) === 0x08074b50) descriptorOffset += 4;
    writeU32(corrupted, descriptorOffset, readU32(corrupted, descriptorOffset) ^ 0x01);

    expect(() => extractSaveSetZip({ mode: "PLAYER_SAFE", archive: corrupted }))
      .toThrow("SAVESET_ZIP_MALFORMED");
  });

  it("fails closed for malformed archives", () => {
    const archive = createSaveSetZip({ mode: "PLAYER_SAFE", members: membersFor("PLAYER_SAFE") });
    expect(() => extractSaveSetZip({ mode: "PLAYER_SAFE", archive: archive.subarray(0, archive.byteLength - 1) }))
      .toThrow("SAVESET_ZIP_MALFORMED");
  });
});
