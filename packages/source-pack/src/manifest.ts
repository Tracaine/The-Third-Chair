import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { realpath, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";

import { runProcess } from "./process.js";

export const SourceDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().positive(),
  edition: z.enum(["SRD_5_1", "FORGOTTEN_REALMS", "FRCS_3E_LORE_ONLY"]),
  permittedKinds: z.array(z.enum(["MECHANICS", "LORE", "TIMELINE"])).min(1),
  method: z.enum(["PDF_TEXT", "SELECTIVE_OCR"]),
});
export const SourceDocumentConfigSchema = z.object({ version: z.literal(1), documents: z.array(SourceDocumentSchema).min(1) });
export type SourceDocumentConfig = z.infer<typeof SourceDocumentConfigSchema>;
export type SourceDocument = z.infer<typeof SourceDocumentSchema> & { absolutePath: string };

export interface SourceManifest {
  schemaVersion: number;
  documents: Array<Pick<SourceDocument, "id" | "title" | "sha256" | "pageCount" | "edition" | "permittedKinds" | "method">>;
  toolVersions: Record<string, string>;
  selectionHash: string;
  aliasHash: string;
  builtAtUtc: string;
  sourcePackManifestHash: string;
  buildRecordHash: string;
}

interface VerifyDependencies {
  pageCount(path: string): Promise<number>;
  toolVersion(tool: string): Promise<string>;
}

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
};

const digest = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");

export function hashIdentityConfig(value: unknown): string { return digest(JSON.stringify(value)); }

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

const defaultDependencies: VerifyDependencies = {
  async pageCount(path) {
    const { stdout } = await runProcess("pdfinfo", [path]);
    const match = /^Pages:\s+(\d+)$/m.exec(stdout);
    if (!match) throw new Error("SOURCE_PAGE_COUNT_UNREADABLE");
    return Number(match[1]);
  },
  async toolVersion(tool) {
    const output = await runProcess(tool, toolVersionArguments(tool));
    return (output.stdout || output.stderr).split(/\r?\n/, 1)[0]!.trim();
  },
};

export function toolVersionArguments(tool: string): string[] {
  return [tool === "pdfinfo" || tool === "pdftotext" || tool === "pdftoppm" ? "-v" : "--version"];
}

export function hashManifest(manifest: Record<string, unknown>): string {
  const docs = Array.isArray(manifest.documents)
    ? manifest.documents.map((item) => {
        const d = item as Record<string, unknown>;
        return { id: d.id, sha256: d.sha256, pageCount: d.pageCount, edition: d.edition };
      })
    : [];
  return digest(canonical({
    schemaVersion: manifest.schemaVersion,
    documents: docs,
    selectionHash: manifest.selectionHash ?? "",
    aliasHash: manifest.aliasHash ?? "",
  }));
}

export async function loadSourceConfig(path: string): Promise<SourceDocumentConfig> {
  return SourceDocumentConfigSchema.parse(JSON.parse(await readFile(path, "utf8")));
}

export async function verifySourceDocuments(
  rawConfig: SourceDocumentConfig,
  root: string,
  dependencies: VerifyDependencies = defaultDependencies,
  identity: { selectionHash?: string; aliasHash?: string } = {},
): Promise<{ manifest: SourceManifest; documents: SourceDocument[] }> {
  const config = SourceDocumentConfigSchema.parse(rawConfig);
  const sourceRoot = await realpath(resolve(root, "project_sources"));
  const documents: SourceDocument[] = [];
  for (const document of config.documents) {
    const candidate = resolve(root, document.path);
    const rel = relative(sourceRoot, candidate);
    if (isAbsolute(document.path) || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error("SOURCE_PATH_OUTSIDE_ROOT");
    }
    let absolutePath: string;
    try { absolutePath = await realpath(candidate); } catch { throw new Error(`SOURCE_NOT_FOUND:${document.id}`); }
    const realRel = relative(sourceRoot, absolutePath);
    if (realRel === ".." || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) throw new Error("SOURCE_PATH_OUTSIDE_ROOT");
    if (await hashFile(absolutePath) !== document.sha256) throw new Error(`SOURCE_HASH_MISMATCH:${document.id}`);
    if (await dependencies.pageCount(absolutePath) !== document.pageCount) throw new Error(`SOURCE_PAGE_COUNT_MISMATCH:${document.id}`);
    documents.push({ ...document, absolutePath });
  }

  const toolVersions: Record<string, string> = {};
  for (const tool of ["pdfinfo", "pdftotext", "pdftoppm", "ocrmypdf", "tesseract"]) {
    try { toolVersions[tool] = await dependencies.toolVersion(tool); }
    catch { throw new Error(`SOURCE_DEPENDENCY_MISSING:${tool}`); }
  }
  const builtAtUtc = new Date().toISOString();
  const base = {
    schemaVersion: 1,
    documents: documents.map(({ absolutePath: _path, path: _relative, ...document }) => document),
    selectionHash: identity.selectionHash ?? "",
    aliasHash: identity.aliasHash ?? "",
    toolVersions,
    builtAtUtc,
  };
  const sourcePackManifestHash = hashManifest(base);
  const buildRecordHash = digest(canonical(base));
  return { manifest: { ...base, sourcePackManifestHash, buildRecordHash }, documents };
}
