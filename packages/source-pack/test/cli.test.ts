import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseCliArgs } from "../src/cli.js";
import cases from "./fixtures/retrieval-cases.json" with { type: "json" };
import { createRetrievalFixture } from "./retrieval-fixture.js";

describe("source-pack CLI", () => {
  test("parses a Windows-safe build command without relying on current working directory", () => {
    expect(parseCliArgs(["build", "--config", "packages/source-pack/config/documents.v1.json", "--output", "private/source-pack.sqlite"]))
      .toEqual({ command: "build", config: "packages/source-pack/config/documents.v1.json", output: "private/source-pack.sqlite" });
  });

  test("runs fixture checks when the CLI is executed from a path containing spaces", () => {
    const tempRoot = resolve(import.meta.dirname, "../../../tmp");
    mkdirSync(tempRoot, { recursive: true });
    const directory = mkdtempSync(join(tempRoot, "Third Chair CLI "));
    try {
      const packageRoot = resolve(import.meta.dirname, "..");
      for (const folder of ["src", "config", "migrations", join("test", "fixtures")]) {
        cpSync(join(packageRoot, folder), join(directory, folder), { recursive: true });
      }
      const database = join(directory, "source pack.sqlite");
      const { db } = createRetrievalFixture(database);
      db.close();

      const result = spawnSync(process.execPath, [
        "--conditions=development", "--import", "tsx", join("src", "cli.ts"),
        "test-fixtures", "--database", database,
      ], { cwd: directory, encoding: "utf8" });

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).not.toBe("");
      expect(JSON.parse(result.stdout)).toEqual({
        status: "PASS",
        fixtures: cases.map(({ id }) => ({ id, status: "PASS" })),
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
