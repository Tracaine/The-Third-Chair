import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { buildAtomically } from "../src/build.js";
import { promoteSourcePack } from "../src/promote.js";

const sha = async (path: string) => createHash("sha256").update(await readFile(path)).digest("hex");

describe("atomic source-pack assembly", () => {
  test("preserves an existing destination byte-for-byte when assembly fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "source-pack-atomic-")); const destination = join(directory, "source-pack.sqlite");
    await writeFile(destination, "trusted-old-pack"); const before = await sha(destination);
    await expect(buildAtomically(destination, async (pending) => { await writeFile(pending, "partial"); throw new Error("parser failed"); }))
      .rejects.toThrow("parser failed");
    expect(await sha(destination)).toBe(before);
  });

  test("promotes a verified pending file and retains the prior pack", async () => {
    const directory = await mkdtemp(join(tmpdir(), "source-pack-promote-")); const destination = join(directory, "source-pack.sqlite");
    const pending = join(directory, "pending.sqlite"); await writeFile(destination, "old"); await writeFile(pending, "new");
    await promoteSourcePack(pending, destination);
    expect(await readFile(destination, "utf8")).toBe("new");
    expect(await readFile(`${destination}.previous`, "utf8")).toBe("old");
  });

  test("promotes cleanly when no prior destination exists", async () => {
    const directory = await mkdtemp(join(tmpdir(), "source-pack-first-")); const destination = join(directory, "source-pack.sqlite");
    const pending = join(directory, "pending.sqlite"); await writeFile(pending, "first");
    await promoteSourcePack(pending, destination);
    expect(await readFile(destination, "utf8")).toBe("first");
  });
});
