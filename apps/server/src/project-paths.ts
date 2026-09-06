import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findProjectRoot(startPath: string): string {
  let candidate = startPath;
  const filesystemRoot = parse(candidate).root;

  while (candidate !== filesystemRoot) {
    if (
      existsSync(join(candidate, "package.json")) &&
      existsSync(join(candidate, "apps", "server", "package.json")) &&
      existsSync(join(candidate, "apps", "widget", "package.json"))
    ) {
      return candidate;
    }
    candidate = dirname(candidate);
  }

  throw new Error("THIRD_CHAIR_PROJECT_ROOT_NOT_FOUND");
}

export const PROJECT_ROOT = findProjectRoot(dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_CAMPAIGN_DATABASE_PATH = resolve(PROJECT_ROOT, "private", "campaigns.sqlite");
export const DEFAULT_SOURCE_PACK_DATABASE_PATH = resolve(PROJECT_ROOT, "private", "source-pack.sqlite");
export const DEFAULT_WIDGET_BUILD_PATH = resolve(PROJECT_ROOT, "apps", "widget", "dist", "index.html");
