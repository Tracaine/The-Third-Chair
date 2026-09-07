import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/run-beta.mjs");
const cases = resolve("evals/cases/chair-005-beta.jsonl");

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "third-chair-beta-"));
  const result = join(directory, "result.json");
  const recorded = spawnSync(process.execPath, [script, "--record", cases, "--out", result], { encoding: "utf8" });
  expect(recorded.status, recorded.stderr).toBe(0);
  return { directory, result, record: JSON.parse(readFileSync(result, "utf8")) as Record<string, any> };
}

describe("Chair 005 beta gate", () => {
  it("accepts the twelve-decision qualification record", () => {
    const item = fixture();
    try { expect(JSON.parse(spawnSync(process.execPath, [script, "--verify", item.result], { encoding: "utf8" }).stdout)).toMatchObject({ status: "PASS", decisions: 12, finalStateVersion: 11 }); }
    finally { rmSync(item.directory, { recursive: true, force: true }); }
  });

  it.each([
    ["too short", (record: any) => record.decisions.pop(), "FEWER_THAN_TWELVE_DECISIONS"],
    ["sentinel", (record: any) => { record.evidence.sentinelOccurrences = 1; }, "SENTINEL_OCCURRENCE"],
    ["version gap", (record: any) => { record.decisions[5].beforeVersion += 1; }, "STATE_VERSION_GAP"],
    ["manual repair", (record: any) => { record.evidence.manualDatabaseRepair = true; }, "MANUAL_DATABASE_REPAIR_DETECTED"],
    ["unverified import", (record: any) => { record.evidence.fullPrivateImportVerified = false; }, "SAVESET_IMPORT_UNVERIFIED"],
  ])("rejects %s", (_label, mutate, code) => {
    const item = fixture();
    try {
      mutate(item.record);
      writeFileSync(item.result, JSON.stringify(item.record));
      const checked = spawnSync(process.execPath, [script, "--verify", item.result], { encoding: "utf8" });
      expect(checked.status).toBe(1);
      expect(JSON.parse(checked.stdout).errors).toContain(code);
    } finally { rmSync(item.directory, { recursive: true, force: true }); }
  });
});
