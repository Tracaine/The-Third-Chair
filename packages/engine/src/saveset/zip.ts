import { Unzip, UnzipInflate, zipSync } from "fflate";
import {
  SAVESET_MAX_ARCHIVE_BYTES,
  SAVESET_MAX_MEMBER_BYTES,
  SaveSetModeSchema,
  saveSetArchiveMemberPaths,
  type SaveSetMode,
} from "@third-chair/contracts";

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_DATA_DESCRIPTOR_HEADER = 0x08074b50;

export interface SaveSetZipMember {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface SaveSetZipLimits {
  /** Lower test or operational limits are allowed; SaveSet hard caps never increase. */
  readonly maxArchiveBytes?: number;
  /** Lower test or operational limits are allowed; SaveSet hard caps never increase. */
  readonly maxMemberBytes?: number;
}

export interface CreateSaveSetZipInput {
  readonly mode: SaveSetMode;
  readonly members: readonly SaveSetZipMember[];
  readonly limits?: SaveSetZipLimits;
}

export interface ExtractSaveSetZipInput {
  readonly mode: SaveSetMode;
  readonly archive: Uint8Array;
  readonly limits?: SaveSetZipLimits;
}

interface ResolvedZipLimits {
  readonly maxArchiveBytes: number;
  readonly maxMemberBytes: number;
}

interface NameTracker {
  readonly names: Set<string>;
  readonly caseFoldedNames: Map<string, string>;
}

interface CentralDirectoryEntry {
  readonly rawName: string;
  readonly path: string;
  readonly flags: number;
  readonly crc32: number;
  readonly compression: number;
  readonly compressedBytes: number;
  readonly uncompressedBytes: number;
  readonly localHeaderOffset: number;
}

function zipError(code: string): Error {
  return new Error(code);
}

function isZipError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("SAVESET_ZIP_");
}

function asZipError(error: unknown): Error {
  return isZipError(error) ? error : zipError("SAVESET_ZIP_MALFORMED");
}

function resolveLimit(value: number | undefined, ceiling: number): number {
  if (value === undefined) return ceiling;
  if (!Number.isSafeInteger(value) || value < 0 || value > ceiling) {
    throw zipError("SAVESET_ZIP_LIMIT_INVALID");
  }
  return value;
}

function resolveLimits(limits: SaveSetZipLimits | undefined): ResolvedZipLimits {
  if (limits !== undefined && (limits === null || typeof limits !== "object")) {
    throw zipError("SAVESET_ZIP_LIMIT_INVALID");
  }
  return {
    maxArchiveBytes: resolveLimit(limits?.maxArchiveBytes, SAVESET_MAX_ARCHIVE_BYTES),
    maxMemberBytes: resolveLimit(limits?.maxMemberBytes, SAVESET_MAX_MEMBER_BYTES),
  };
}

/**
 * Accepts only canonical relative member paths. Safe backslash separators are
 * converted to `/`; every potentially absolute or traversal-shaped variant is
 * rejected before a member can be matched or written.
 */
export function normalizeArchivePath(rawPath: string): string {
  if (typeof rawPath !== "string" || rawPath.length === 0 || rawPath.includes("\u0000")) {
    throw zipError("SAVESET_ZIP_PATH_INVALID");
  }
  if (rawPath.endsWith("/") || rawPath.endsWith("\\")) {
    throw zipError("SAVESET_ZIP_DIRECTORY_ENTRY");
  }
  if (/^(?:\\\\|\/\/)/.test(rawPath)) throw zipError("SAVESET_ZIP_UNC_PATH");
  if (/^[\\/]/.test(rawPath)) throw zipError("SAVESET_ZIP_ABSOLUTE_PATH");
  if (/^[A-Za-z]:/.test(rawPath)) throw zipError("SAVESET_ZIP_DRIVE_PATH");

  const path = rawPath.replaceAll("\\", "/");
  if (path.startsWith("//")) throw zipError("SAVESET_ZIP_UNC_PATH");
  if (path.startsWith("/")) throw zipError("SAVESET_ZIP_ABSOLUTE_PATH");
  if (/^[A-Za-z]:/.test(path)) throw zipError("SAVESET_ZIP_DRIVE_PATH");

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === ".")) {
    throw zipError("SAVESET_ZIP_PATH_INVALID");
  }
  if (segments.some((segment) => segment === "..")) throw zipError("SAVESET_ZIP_PATH_TRAVERSAL");

  return segments.join("/");
}

function createNameTracker(): NameTracker {
  return { names: new Set<string>(), caseFoldedNames: new Map<string, string>() };
}

function observeMemberName(rawName: string, expected: ReadonlySet<string>, tracker: NameTracker): string {
  const path = normalizeArchivePath(rawName);
  if (tracker.names.has(path)) throw zipError("SAVESET_ZIP_DUPLICATE_MEMBER");

  const folded = path.toLowerCase();
  if (tracker.caseFoldedNames.has(folded)) throw zipError("SAVESET_ZIP_CASE_COLLISION");
  if (!expected.has(path)) throw zipError("SAVESET_ZIP_UNEXPECTED_MEMBER");

  tracker.names.add(path);
  tracker.caseFoldedNames.set(folded, path);
  return path;
}

function assertRequiredMembers(expected: ReadonlySet<string>, tracker: NameTracker): void {
  for (const path of expected) {
    if (!tracker.names.has(path)) throw zipError(`SAVESET_ZIP_MISSING_MEMBER:${path}`);
  }
}

function validateMembers(
  rawMembers: readonly SaveSetZipMember[],
  expected: ReadonlySet<string>,
  limits: ResolvedZipLimits,
): Map<string, Uint8Array> {
  if (!Array.isArray(rawMembers)) throw zipError("SAVESET_ZIP_MEMBERS_INVALID");

  const tracker = createNameTracker();
  const members = new Map<string, Uint8Array>();
  for (const rawMember of rawMembers) {
    if (rawMember === null || typeof rawMember !== "object") throw zipError("SAVESET_ZIP_MEMBER_INVALID");
    const member = rawMember as SaveSetZipMember;
    if (typeof member.path !== "string" || !(member.bytes instanceof Uint8Array)) {
      throw zipError("SAVESET_ZIP_MEMBER_INVALID");
    }
    const path = observeMemberName(member.path, expected, tracker);
    if (member.bytes.byteLength > limits.maxMemberBytes) {
      throw zipError(`SAVESET_ZIP_MEMBER_TOO_LARGE:${path}`);
    }
    members.set(path, member.bytes);
  }
  assertRequiredMembers(expected, tracker);
  return members;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

function requireRange(bytes: Uint8Array, offset: number, length: number): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0
    || offset + length > bytes.byteLength) {
    throw zipError("SAVESET_ZIP_MALFORMED");
  }
}

function decodeZipName(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw zipError("SAVESET_ZIP_MALFORMED");
  }
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0
        ? (0xedb88320 ^ (value >>> 1))
        : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function updateCrc32(crc: number, bytes: Uint8Array): number {
  let value = crc >>> 0;
  for (const byte of bytes) {
    value = (CRC32_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8)) >>> 0;
  }
  return value;
}

function isDirectoryEntry(name: string, externalAttributes: number): boolean {
  const unixMode = externalAttributes >>> 16;
  const dosAttributes = externalAttributes & 0xffff;
  return name.endsWith("/")
    || name.endsWith("\\")
    || (dosAttributes & 0x10) !== 0
    || (unixMode & 0o170000) === 0o040000;
}

interface EndOfCentralDirectory {
  readonly offset: number;
  readonly entryCount: number;
  readonly centralDirectoryOffset: number;
  readonly centralDirectoryBytes: number;
}

function findEndOfCentralDirectory(bytes: Uint8Array): EndOfCentralDirectory {
  if (bytes.byteLength < 22) throw zipError("SAVESET_ZIP_MALFORMED");
  const firstOffset = Math.max(0, bytes.byteLength - 0xffff - 22);

  for (let offset = bytes.byteLength - 22; offset >= firstOffset; offset -= 1) {
    if (readUint32(bytes, offset) !== ZIP_END_OF_CENTRAL_DIRECTORY) continue;
    const commentBytes = readUint16(bytes, offset + 20);
    if (offset + 22 + commentBytes !== bytes.byteLength) continue;

    const diskNumber = readUint16(bytes, offset + 4);
    const centralDirectoryDisk = readUint16(bytes, offset + 6);
    const entriesOnDisk = readUint16(bytes, offset + 8);
    const entryCount = readUint16(bytes, offset + 10);
    const centralDirectoryBytes = readUint32(bytes, offset + 12);
    const centralDirectoryOffset = readUint32(bytes, offset + 16);

    if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount
      || entriesOnDisk === 0xffff || entryCount === 0xffff
      || centralDirectoryBytes === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
      throw zipError("SAVESET_ZIP_MALFORMED");
    }

    return { offset, entryCount, centralDirectoryOffset, centralDirectoryBytes };
  }

  throw zipError("SAVESET_ZIP_MALFORMED");
}

function validateLocalHeader(
  bytes: Uint8Array,
  entry: CentralDirectoryEntry,
  centralDirectoryOffset: number,
): void {
  requireRange(bytes, entry.localHeaderOffset, 30);
  if (readUint32(bytes, entry.localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER) {
    throw zipError("SAVESET_ZIP_MALFORMED");
  }

  const flags = readUint16(bytes, entry.localHeaderOffset + 6);
  const compression = readUint16(bytes, entry.localHeaderOffset + 8);
  const crc32 = readUint32(bytes, entry.localHeaderOffset + 14);
  const compressedBytes = readUint32(bytes, entry.localHeaderOffset + 18);
  const uncompressedBytes = readUint32(bytes, entry.localHeaderOffset + 22);
  const nameBytes = readUint16(bytes, entry.localHeaderOffset + 26);
  const extraBytes = readUint16(bytes, entry.localHeaderOffset + 28);
  const nameOffset = entry.localHeaderOffset + 30;
  requireRange(bytes, nameOffset, nameBytes + extraBytes);

  const rawName = decodeZipName(bytes.subarray(nameOffset, nameOffset + nameBytes));
  if (rawName !== entry.rawName || flags !== entry.flags || compression !== entry.compression) {
    throw zipError("SAVESET_ZIP_MALFORMED");
  }

  const dataOffset = nameOffset + nameBytes + extraBytes;
  const dataEnd = dataOffset + entry.compressedBytes;
  if (dataEnd > centralDirectoryOffset) {
    throw zipError("SAVESET_ZIP_MALFORMED");
  }

  if ((flags & 0x0008) === 0) {
    if (crc32 !== entry.crc32
      || compressedBytes !== entry.compressedBytes
      || uncompressedBytes !== entry.uncompressedBytes) {
      throw zipError("SAVESET_ZIP_MALFORMED");
    }
    return;
  }

  if ((crc32 !== 0 && crc32 !== entry.crc32)
    || (compressedBytes !== 0 && compressedBytes !== entry.compressedBytes)
    || (uncompressedBytes !== 0 && uncompressedBytes !== entry.uncompressedBytes)) {
    throw zipError("SAVESET_ZIP_MALFORMED");
  }

  let descriptorOffset = dataEnd;
  requireRange(bytes, descriptorOffset, 12);
  if (readUint32(bytes, descriptorOffset) === ZIP_DATA_DESCRIPTOR_HEADER) {
    descriptorOffset += 4;
    requireRange(bytes, descriptorOffset, 12);
  }

  const descriptorCrc32 = readUint32(bytes, descriptorOffset);
  const descriptorCompressedBytes = readUint32(bytes, descriptorOffset + 4);
  const descriptorUncompressedBytes = readUint32(bytes, descriptorOffset + 8);
  if (descriptorCrc32 !== entry.crc32
    || descriptorCompressedBytes !== entry.compressedBytes
    || descriptorUncompressedBytes !== entry.uncompressedBytes
    || descriptorOffset + 12 > centralDirectoryOffset) {
    throw zipError("SAVESET_ZIP_MALFORMED");
  }
}

function inspectCentralDirectory(
  archive: Uint8Array,
  expected: ReadonlySet<string>,
  limits: ResolvedZipLimits,
): Map<string, CentralDirectoryEntry> {
  const end = findEndOfCentralDirectory(archive);
  const centralDirectoryEnd = end.centralDirectoryOffset + end.centralDirectoryBytes;
  if (centralDirectoryEnd !== end.offset) {
    throw zipError("SAVESET_ZIP_MALFORMED");
  }
  requireRange(archive, end.centralDirectoryOffset, end.centralDirectoryBytes);

  const tracker = createNameTracker();
  const entries = new Map<string, CentralDirectoryEntry>();
  const localHeaderOffsets = new Set<number>();
  let offset = end.centralDirectoryOffset;

  for (let index = 0; index < end.entryCount; index += 1) {
    requireRange(archive, offset, 46);
    if (readUint32(archive, offset) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
      throw zipError("SAVESET_ZIP_MALFORMED");
    }

    const flags = readUint16(archive, offset + 8);
    const crc32 = readUint32(archive, offset + 16);
    const compression = readUint16(archive, offset + 10);
    const compressedBytes = readUint32(archive, offset + 20);
    const uncompressedBytes = readUint32(archive, offset + 24);
    const nameBytes = readUint16(archive, offset + 28);
    const extraBytes = readUint16(archive, offset + 30);
    const commentBytes = readUint16(archive, offset + 32);
    const diskStart = readUint16(archive, offset + 34);
    const externalAttributes = readUint32(archive, offset + 38);
    const localHeaderOffset = readUint32(archive, offset + 42);
    const recordBytes = 46 + nameBytes + extraBytes + commentBytes;
    requireRange(archive, offset, recordBytes);

    if ((flags & 0x0001) !== 0 || diskStart !== 0 || compression !== 0 && compression !== 8
      || compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw zipError("SAVESET_ZIP_MALFORMED");
    }

    const rawName = decodeZipName(archive.subarray(offset + 46, offset + 46 + nameBytes));
    if (isDirectoryEntry(rawName, externalAttributes)) throw zipError("SAVESET_ZIP_DIRECTORY_ENTRY");
    const path = observeMemberName(rawName, expected, tracker);
    if (uncompressedBytes > limits.maxMemberBytes) {
      throw zipError(`SAVESET_ZIP_MEMBER_TOO_LARGE:${path}`);
    }
    if (localHeaderOffsets.has(localHeaderOffset)) throw zipError("SAVESET_ZIP_MALFORMED");
    localHeaderOffsets.add(localHeaderOffset);

    const entry: CentralDirectoryEntry = {
      rawName,
      path,
      flags,
      crc32,
      compression,
      compressedBytes,
      uncompressedBytes,
      localHeaderOffset,
    };
    validateLocalHeader(archive, entry, end.centralDirectoryOffset);
    entries.set(path, entry);
    offset += recordBytes;
  }

  if (offset !== centralDirectoryEnd) throw zipError("SAVESET_ZIP_MALFORMED");
  assertRequiredMembers(expected, tracker);
  return entries;
}

function joinChunks(chunks: readonly Uint8Array[], byteLength: number): Uint8Array {
  const joined = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

/** Creates a mode-exact ZIP from already-prepared SaveSet members. */
export function createSaveSetZip(input: CreateSaveSetZipInput): Uint8Array {
  const mode = SaveSetModeSchema.parse(input.mode);
  const limits = resolveLimits(input.limits);
  const expected = new Set(saveSetArchiveMemberPaths(mode));
  const members = validateMembers(input.members, expected, limits);
  const files: Record<string, Uint8Array> = {};

  for (const [path, bytes] of members) files[path] = bytes;

  let archive: Uint8Array;
  try {
    archive = zipSync(files, { level: 6 });
  } catch (error) {
    throw asZipError(error);
  }
  if (archive.byteLength > limits.maxArchiveBytes) throw zipError("SAVESET_ZIP_ARCHIVE_TOO_LARGE");
  return archive;
}

/**
 * Extracts a complete mode-exact archive entirely in memory. The central
 * directory is cross-checked first, then fflate's streaming Unzip observes each
 * local entry independently so duplicate evidence is never collapsed into an
 * object key before validation.
 */
export function extractSaveSetZip(input: ExtractSaveSetZipInput): Readonly<Record<string, Uint8Array>> {
  const mode = SaveSetModeSchema.parse(input.mode);
  const limits = resolveLimits(input.limits);
  if (!(input.archive instanceof Uint8Array)) throw zipError("SAVESET_ZIP_ARCHIVE_INVALID");
  if (input.archive.byteLength > limits.maxArchiveBytes) throw zipError("SAVESET_ZIP_ARCHIVE_TOO_LARGE");

  const expected = new Set(saveSetArchiveMemberPaths(mode));
  const centralEntries = inspectCentralDirectory(input.archive, expected, limits);
  const streamedNames = createNameTracker();
  const extracted = new Map<string, Uint8Array>();
  let extractionFailure: Error | undefined;

  const failExtraction = (error: unknown): void => {
    if (extractionFailure === undefined) extractionFailure = asZipError(error);
  };

  const unzip = new Unzip((file) => {
    if (extractionFailure !== undefined) {
      file.terminate();
      return;
    }

    try {
      if (file.compression !== 0 && file.compression !== 8) {
        throw zipError("SAVESET_ZIP_MALFORMED");
      }
      const path = observeMemberName(file.name, expected, streamedNames);
      const central = centralEntries.get(path);
      if (central === undefined || file.compression !== central.compression
        || file.originalSize !== undefined && file.originalSize !== central.uncompressedBytes) {
        throw zipError("SAVESET_ZIP_MALFORMED");
      }
      if (file.originalSize !== undefined && file.originalSize > limits.maxMemberBytes) {
        throw zipError(`SAVESET_ZIP_MEMBER_TOO_LARGE:${path}`);
      }

      const chunks: Uint8Array[] = [];
      let byteLength = 0;
      let crc32 = 0xffffffff;
      let complete = false;
      file.ondata = (error, chunk, final) => {
        if (extractionFailure !== undefined) return;
        if (error !== null) {
          failExtraction(error);
          return;
        }
        if (complete) {
          failExtraction(zipError("SAVESET_ZIP_MALFORMED"));
          return;
        }
        if (chunk.byteLength > limits.maxMemberBytes - byteLength) {
          failExtraction(zipError(`SAVESET_ZIP_MEMBER_TOO_LARGE:${path}`));
          file.terminate();
          return;
        }

        crc32 = updateCrc32(crc32, chunk);
        chunks.push(new Uint8Array(chunk));
        byteLength += chunk.byteLength;
        if (final) {
          complete = true;
          if (byteLength !== central.uncompressedBytes) {
            failExtraction(zipError("SAVESET_ZIP_MALFORMED"));
            return;
          }
          const finalCrc32 = (crc32 ^ 0xffffffff) >>> 0;
          if (finalCrc32 !== central.crc32) {
            failExtraction(zipError(`SAVESET_ZIP_CRC_MISMATCH:${path}`));
            return;
          }
          extracted.set(path, joinChunks(chunks, byteLength));
        }
      };
      file.start();
    } catch (error) {
      failExtraction(error);
      file.terminate();
    }
  });
  unzip.register(UnzipInflate);

  try {
    unzip.push(input.archive, true);
  } catch (error) {
    failExtraction(error);
  }

  if (extractionFailure !== undefined) throw extractionFailure;
  assertRequiredMembers(expected, streamedNames);
  if (extracted.size !== expected.size) throw zipError("SAVESET_ZIP_MALFORMED");

  return Object.fromEntries([...extracted.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export const readSaveSetZip = extractSaveSetZip;
