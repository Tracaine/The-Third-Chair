import { resolve } from "node:path";
import { z } from "zod";

import { loadSourceConfig, verifySourceDocuments } from "./manifest.js";

const ArgsSchema = z.object({ command: z.enum(["verify", "build", "query", "test-fixtures"]), config: z.string() });

function parseArgs(argv: string[]) {
  const command = argv[0];
  const configIndex = argv.indexOf("--config");
  return ArgsSchema.parse({ command, config: configIndex >= 0 ? argv[configIndex + 1] : "packages/source-pack/config/documents.v1.json" });
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const root = process.env.INIT_CWD ?? resolve(import.meta.dirname, "../../..");
  if (args.command !== "verify") throw new Error(`COMMAND_NOT_IMPLEMENTED:${args.command}`);
  const config = await loadSourceConfig(resolve(root, args.config));
  const { manifest } = await verifySourceDocuments(config, root);
  process.stdout.write(`${JSON.stringify({ status: "PASS", sourcePackManifestHash: manifest.sourcePackManifestHash })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
