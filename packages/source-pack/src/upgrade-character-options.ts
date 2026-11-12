import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import aliases from "../config/aliases.v1.json" with { type: "json" };
import { buildAtomically } from "./build.js";
import { extractNativeText } from "./extraction/pdf-text.js";
import { assertSourcePackIntegrity, openSourcePackReadOnly } from "./indexing/database.js";
import { SourcePackWriter } from "./indexing/writer.js";
import { hashManifest, loadSourceConfig } from "./manifest.js";
import { extractSrdCharacterOptions } from "./parsing/srd-character-options.js";
import { SqliteSourcePackService } from "./retrieval/service.js";

export async function upgradeCharacterOptions(root: string, configPath: string, databasePath: string) {
  const destination = resolve(root, databasePath);
  const source = openSourcePackReadOnly(destination);
  try {
    const service = new SqliteSourcePackService(source, aliases);
    const manifest = service.manifest();
    const sourcePackManifestHash = manifest.sourcePackManifestHash;
    if (sourcePackManifestHash !== hashManifest(manifest)) throw new Error("SOURCE_PACK_MANIFEST_INVALID");
    const current = service.characterOptions().length;
    if (manifest.characterOptionsRevision === 1 && current > 0) {
      return { status: "ALREADY_CURRENT", sourcePackManifestHash, characterOptions: current };
    }

    const config = await loadSourceConfig(resolve(root, configPath));
    const document = config.documents.find(({ id }) => id === "srd-5.1");
    if (!document) throw new Error("SOURCE_NOT_FOUND:srd-5.1");
    const sourceRoot = await realpath(resolve(root, "project_sources"));
    const absolutePath = await realpath(resolve(root, document.path));
    const relativePath = relative(sourceRoot, absolutePath);
    if (isAbsolute(document.path) || isAbsolute(relativePath) || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
      throw new Error("SOURCE_PATH_OUTSIDE_ROOT");
    }
    const expected = source.prepare("SELECT sha256,page_count FROM source_documents WHERE id=?").get(document.id);
    const actual = createHash("sha256").update(await readFile(absolutePath)).digest("hex");
    if (expected?.sha256 !== actual || document.sha256 !== actual || expected.page_count !== document.pageCount) {
      throw new Error("SOURCE_HASH_MISMATCH:srd-5.1");
    }
    const parsed = extractSrdCharacterOptions(await extractNativeText({ ...document, absolutePath }));
    await buildAtomically(destination, async (pending) => {
      await backup(source, pending);
      // Close the original handle before promotion, including on Windows.
      source.close();
      const target = new DatabaseSync(pending);
      try {
        target.exec("PRAGMA foreign_keys=ON");
        const writer = new SourcePackWriter(target);
        writer.insertCharacterCatalog(parsed);
        assertSourcePackIntegrity(target);
      } finally { target.close(); }
    });
    return { status: "PASS", sourcePackManifestHash, characterOptions: parsed.characterOptions.length };
  } finally {
    if (source.isOpen) source.close();
  }
}
