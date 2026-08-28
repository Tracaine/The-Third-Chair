import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

import { extractNativeTextPages } from "../src/extraction/pdf-text.js";
import { parsePageStream } from "../src/parsing/page-stream.js";
import { parseSrdPages } from "../src/parsing/srd.js";

const fixtureUrl = new URL("./fixtures/srd-pages.txt", import.meta.url);

describe("SRD extraction and parsing", () => {
  test("reconstructs one-based pages while removing genuinely repeated margins", async () => {
    const pages = parsePageStream(await readFile(fixtureUrl, "utf8"));
    expect(pages.map((page) => page.page)).toEqual([1, 2, 3]);
    expect(pages.every((page) => !page.text.includes("SRD 5.1"))).toBe(true);
    expect(pages[0]!.text).toContain("2d20 | Higher");
  });

  test("carries an open section across a page and emits stable distinct rule keys", async () => {
    const pages = parsePageStream(await readFile(fixtureUrl, "utf8"));
    const first = parseSrdPages(pages);
    const second = parseSrdPages(pages);
    expect(first.chunks.map((item) => item.id)).toEqual(second.chunks.map((item) => item.id));
    expect(first.ruleSections.map((item) => item.ruleKey)).toEqual([
      "advantage-and-disadvantage", "concentration", "long-rest",
    ]);
    expect(first.chunks[0]).toMatchObject({ pageStart: 1, pageEnd: 2, headingPath: ["Advantage and Disadvantage"] });
    expect(first.chunks[0]!.text).toContain("2d20 | Higher");
  });

  test("invokes pdftotext with the bounded layout-preserving contract", async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const pages = await extractNativeTextPages({ absolutePath: "/private/srd.pdf", pageCount: 403 }, {
      run: async (command, args) => { calls.push({ command, args }); return { stdout: "Heading\nBody\f", stderr: "" }; },
    });
    expect(calls).toEqual([{ command: "pdftotext", args: ["-layout", "-enc", "UTF-8", "-f", "1", "-l", "403", "/private/srd.pdf", "-"] }]);
    expect(pages).toHaveLength(1);
  });
});
