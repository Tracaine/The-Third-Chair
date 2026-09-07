import { cpSync, mkdirSync } from "node:fs";

for (const [source, destination] of [
  ["packages/storage/migrations", "packages/storage/dist/migrations"],
  ["packages/source-pack/migrations", "packages/source-pack/dist/migrations"],
]) {
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}
