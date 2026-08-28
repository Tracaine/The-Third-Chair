import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import aliases from "../config/aliases.v1.json" with { type: "json" };
import selection from "../config/frcs-selection.v1.json" with { type: "json" };
import cases from "../test/fixtures/retrieval-cases.json" with { type: "json" };
import { extractNativeTextPages } from "./extraction/pdf-text.js";
import { runSelectiveOcr } from "./extraction/ocr.js";
import { indexEntities } from "./indexing/entities.js";
import { assertSourcePackIntegrity, openSourcePackForBuild, openSourcePackReadOnly } from "./indexing/database.js";
import { buildTimelineEdges } from "./indexing/timeline.js";
import type { SourceDocumentRecord } from "./indexing/types.js";
import { SourcePackWriter } from "./indexing/writer.js";
import { hashIdentityConfig, loadSourceConfig, verifySourceDocuments } from "./manifest.js";
import { parseFrcsPages } from "./parsing/frcs.js";
import { parseGrandHistoryPages } from "./parsing/grand-history.js";
import { parseSrdPages } from "./parsing/srd.js";
import { parseRetrievalCases, runRetrievalFixtures } from "./retrieval/fixtures.js";
import { SqliteSourcePackService } from "./retrieval/service.js";
import { promoteSourcePack } from "./promote.js";

async function fileHash(path: string): Promise<string> {
  const hash = createHash("sha256"); for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer); return hash.digest("hex");
}

export async function buildAtomically<T>(destination: string, assemble: (pendingPath: string, buildDir: string) => Promise<T>): Promise<T> {
  await mkdir(dirname(destination), { recursive: true });
  const buildDir = await mkdtemp(join(dirname(destination), ".source-pack-build-"));
  const pending = join(buildDir, `source-pack.${randomUUID()}.sqlite.pending`);
  try {
    const result = await assemble(pending, buildDir);
    await promoteSourcePack(pending, destination);
    return result;
  } finally { await rm(buildDir, { recursive: true, force: true }); }
}

export interface BuildSourcePackOptions { repositoryRoot: string; configPath: string; outputPath: string }
export interface SourcePackBuildReport {
  status: "PASS"; sourcePackManifestHash: string; databaseSha256: string;
  counts: Record<string, number>; pagesProcessed: Record<string, number>;
  confidence: Record<string, number>; fixtures: ReturnType<typeof runRetrievalFixtures>; toolVersions: Record<string, string>;
}

export async function buildSourcePack(options: BuildSourcePackOptions): Promise<SourcePackBuildReport> {
  const config = await loadSourceConfig(resolve(options.repositoryRoot, options.configPath));
  const selectionHash = hashIdentityConfig(selection); const aliasHash = hashIdentityConfig(aliases);
  const verified = await verifySourceDocuments(config, options.repositoryRoot, undefined, { selectionHash, aliasHash });
  const destination = resolve(options.repositoryRoot, options.outputPath);
  const report = await buildAtomically(destination, async (pending, buildDir): Promise<SourcePackBuildReport> => {
    const byId = new Map(verified.documents.map((document) => [document.id, document]));
    const srdDocument = byId.get("srd-5.1")!; const historyDocument = byId.get("grand-history")!; const frcsDocument = byId.get("frcs-3e")!;
    const srd = parseSrdPages(await extractNativeTextPages(srdDocument));
    const history = parseGrandHistoryPages(await extractNativeTextPages(historyDocument));
    const timelineDiagnostics: string[] = []; const edges = buildTimelineEdges(history.events, history.references, timelineDiagnostics);
    const frcs = parseFrcsPages(await runSelectiveOcr(frcsDocument.absolutePath, selection, buildDir));
    const allChunks = [...srd.chunks, ...history.chunks, ...frcs.chunks];
    const indexed = indexEntities([...history.chunks, ...frcs.chunks], aliases);
    const db = openSourcePackForBuild(pending);
    try {
      const writer = new SourcePackWriter(db);
      writer.insertManifest(verified.manifest as unknown as Record<string, unknown>);
      for (const document of verified.documents) {
        const record: SourceDocumentRecord = { id: document.id, title: document.title, sha256: document.sha256,
          pageCount: document.pageCount, edition: document.edition, extractionMethod: document.method,
          permittedKinds: document.permittedKinds };
        writer.insertDocument(record);
      }
      writer.insertChunks(allChunks); writer.insertRuleSections(srd.ruleSections); writer.insertTimeline(history.events, edges);
      writer.insertEntities(indexed.entities, indexed.mentions);
      db.exec("ANALYZE"); db.exec("PRAGMA optimize"); assertSourcePackIntegrity(db);
      const fixtures = runRetrievalFixtures(new SqliteSourcePackService(db, aliases), parseRetrievalCases(cases));
      if (fixtures.some((item) => item.status !== "PASS")) throw new Error(`SOURCE_FIXTURES_FAILED:${JSON.stringify(fixtures)}`);
      const confidence = allChunks.reduce<Record<string, number>>((counts, chunk) => {
        counts[chunk.confidenceStatus] = (counts[chunk.confidenceStatus] ?? 0) + 1; return counts;
      }, {});
      db.close();
      const databaseSha256 = await fileHash(pending);
      return { status: "PASS", sourcePackManifestHash: verified.manifest.sourcePackManifestHash, databaseSha256,
        counts: { documents: verified.documents.length, chunks: allChunks.length, ruleSections: srd.ruleSections.length,
          entities: indexed.entities.length, entityMentions: indexed.mentions.length, timelineEvents: history.events.length,
          timelineEdges: edges.length, mechanicsDiagnostics: frcs.diagnostics.length, unresolvedTimelineReferences: timelineDiagnostics.length },
        pagesProcessed: { srd: srdDocument.pageCount, grandHistory: historyDocument.pageCount, frcsOcr: 99 }, confidence,
        fixtures, toolVersions: verified.manifest.toolVersions };
    } catch (error) { if (db.isOpen) db.close(); throw error; }
  });
  await writeFile(`${destination}.report.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const readOnly = openSourcePackReadOnly(destination); readOnly.close();
  return report;
}
