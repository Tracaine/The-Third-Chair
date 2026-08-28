import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";

import {
  hashManifest,
  hashIdentityConfig,
  verifySourceDocuments,
  type SourceDocumentConfig,
} from "../src/manifest.js";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "third-chair-manifest-"));
  await mkdir(join(root, "project_sources"));
  await writeFile(join(root, "project_sources", "source.pdf"), "fixture");
  const config: SourceDocumentConfig = {
    version: 1,
    documents: [{
      id: "fixture",
      title: "Fixture",
      path: "project_sources/source.pdf",
      sha256: sha("fixture"),
      pageCount: 7,
      edition: "SRD_5_1",
      permittedKinds: ["MECHANICS"],
      method: "PDF_TEXT",
    }],
  };
  return { root, config };
}

describe("source manifest verification", () => {
  test("rejects a wrong digest before asking pdfinfo for metadata", async () => {
    const { root, config } = await fixture();
    config.documents[0]!.sha256 = "0".repeat(64);
    const pageCount = vi.fn(async () => 7);
    await expect(verifySourceDocuments(config, root, { pageCount, toolVersion: async () => "v1" }))
      .rejects.toThrow("SOURCE_HASH_MISMATCH");
    expect(pageCount).not.toHaveBeenCalled();
  });

  test("rejects a wrong page count", async () => {
    const { root, config } = await fixture();
    await expect(verifySourceDocuments(config, root, { pageCount: async () => 8, toolVersion: async () => "v1" }))
      .rejects.toThrow("SOURCE_PAGE_COUNT_MISMATCH");
  });

  test("rejects traversal outside project_sources", async () => {
    const { root, config } = await fixture();
    config.documents[0]!.path = "../outside.pdf";
    await expect(verifySourceDocuments(config, root, { pageCount: async () => 7, toolVersion: async () => "v1" }))
      .rejects.toThrow("SOURCE_PATH_OUTSIDE_ROOT");
  });

  test("reports a stable dependency error", async () => {
    const { root, config } = await fixture();
    await expect(verifySourceDocuments(config, root, {
      pageCount: async () => 7,
      toolVersion: async (tool) => {
        if (tool === "tesseract") throw new Error("spawn ENOENT");
        return "v1";
      },
    })).rejects.toThrow("SOURCE_DEPENDENCY_MISSING:tesseract");
  });

  test("manifest identity is independent of object key order and build time", () => {
    const a = { schemaVersion: 1, selectionHash: "s", documents: [{ id: "x", sha256: "h", pageCount: 1, edition: "SRD_5_1" }], aliasHash: "a", builtAtUtc: "today" };
    const b = { builtAtUtc: "tomorrow", aliasHash: "a", documents: [{ edition: "SRD_5_1", pageCount: 1, sha256: "h", id: "x" }], selectionHash: "s", schemaVersion: 1 };
    expect(hashManifest(a)).toBe(hashManifest(b));
  });

  test("produces explicit, distinct identity hashes for selection and alias configs", () => {
    const selectionHash = hashIdentityConfig({ ranges: [76, 97] });
    const aliasHash = hashIdentityConfig({ aliases: ["Zhents"] });
    expect(selectionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(aliasHash).toMatch(/^[a-f0-9]{64}$/);
    expect(selectionHash).not.toBe(aliasHash);
  });
});
