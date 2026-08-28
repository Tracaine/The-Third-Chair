import { resolve } from "node:path";
import aliases from "../config/aliases.v1.json" with { type: "json" };
import cases from "../test/fixtures/retrieval-cases.json" with { type: "json" };
import { buildSourcePack } from "./build.js";
import { openSourcePackReadOnly } from "./indexing/database.js";
import { loadSourceConfig, verifySourceDocuments } from "./manifest.js";
import { parseRetrievalCases, runRetrievalFixtures } from "./retrieval/fixtures.js";
import { SqliteSourcePackService } from "./retrieval/service.js";

type CliArgs =
  | { command: "verify"; config: string }
  | { command: "build"; config: string; output: string }
  | { command: "test-fixtures"; database: string }
  | { command: "query"; database: string; kind: "rules" | "lore" | "timeline"; query: string };

export function parseCliArgs(argv: string[]): CliArgs {
  const command = argv[0];
  const value = (flag: string) => { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] : undefined; };
  if (command === "verify") return { command, config: value("--config") ?? "packages/source-pack/config/documents.v1.json" };
  if (command === "build") return { command, config: value("--config") ?? "packages/source-pack/config/documents.v1.json",
    output: value("--output") ?? "private/source-pack.sqlite" };
  if (command === "test-fixtures") return { command, database: value("--database") ?? "private/source-pack.sqlite" };
  if (command === "query") {
    const kind = value("--kind"); if (kind !== "rules" && kind !== "lore" && kind !== "timeline") throw new Error("CLI_KIND_REQUIRED");
    return { command, database: value("--database") ?? "private/source-pack.sqlite", kind, query: value("--query") ?? "" };
  }
  throw new Error("CLI_COMMAND_INVALID");
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseCliArgs(argv);
  const root = process.env.INIT_CWD ?? resolve(import.meta.dirname, "../../..");
  if (args.command === "verify") {
    const config = await loadSourceConfig(resolve(root, args.config));
    const { manifest } = await verifySourceDocuments(config, root);
    process.stdout.write(`${JSON.stringify({ status: "PASS", sourcePackManifestHash: manifest.sourcePackManifestHash })}\n`);
    return;
  }
  if (args.command === "build") {
    const report = await buildSourcePack({ repositoryRoot: root, configPath: args.config, outputPath: args.output });
    process.stdout.write(`${JSON.stringify(report)}\n`); return;
  }
  const db = openSourcePackReadOnly(resolve(root, args.database));
  try {
    const service = new SqliteSourcePackService(db, aliases);
    if (args.command === "test-fixtures") {
      const results = runRetrievalFixtures(service, parseRetrievalCases(cases));
      if (results.some((item) => item.status !== "PASS")) throw new Error(`SOURCE_FIXTURES_FAILED:${JSON.stringify(results)}`);
      process.stdout.write(`${JSON.stringify({ status: "PASS", fixtures: results })}\n`); return;
    }
    const results = args.kind === "rules" ? service.searchRules({ query: args.query })
      : args.kind === "lore" ? service.searchLore({ query: args.query, asOfDr: 1375 })
        : service.searchTimeline({ ...(args.query ? { query: args.query } : {}), toDr: 1375 });
    process.stdout.write(`${JSON.stringify(results)}\n`);
  } finally { db.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
