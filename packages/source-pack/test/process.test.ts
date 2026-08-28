import { describe, expect, test } from "vitest";

import { runProcess } from "../src/process.js";
import { toolVersionArguments } from "../src/manifest.js";

describe("safe process boundary", () => {
  test("passes arguments literally without a shell", async () => {
    const result = await runProcess(process.execPath, ["-e", "process.stdout.write(process.argv[1])", "$(whoami); spaced"]);
    expect(result.stdout).toBe("$(whoami); spaced");
  });

  test("returns a stable error containing the exit code", async () => {
    await expect(runProcess(process.execPath, ["-e", "process.exit(7)"]))
      .rejects.toThrow("PROCESS_EXIT_7");
  });

  test("uses Poppler's supported version flag for every Poppler executable", () => {
    expect(["pdfinfo", "pdftotext", "pdftoppm"].map(toolVersionArguments)).toEqual([["-v"], ["-v"], ["-v"]]);
    expect(toolVersionArguments("tesseract")).toEqual(["--version"]);
  });
});
