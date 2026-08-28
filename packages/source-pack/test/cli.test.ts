import { describe, expect, test } from "vitest";
import { parseCliArgs } from "../src/cli.js";

describe("source-pack CLI", () => {
  test("parses a Windows-safe build command without relying on current working directory", () => {
    expect(parseCliArgs(["build", "--config", "packages/source-pack/config/documents.v1.json", "--output", "private/source-pack.sqlite"]))
      .toEqual({ command: "build", config: "packages/source-pack/config/documents.v1.json", output: "private/source-pack.sqlite" });
  });
});
