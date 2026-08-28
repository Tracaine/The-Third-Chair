import { describe, expect, test } from "vitest";
import { runProcess } from "../src/process.js";

describe("safe process input", () => {
  test("can stream stdin into a child", async () => {
    const result = await runProcess(process.execPath, ["-e", "process.stdin.pipe(process.stdout)"], { input: "bounded" });
    expect(result.stdout).toBe("bounded");
  });
});
