import { readFile } from "node:fs/promises";
import { describe, expect, test, vi } from "vitest";

import selection from "../config/frcs-selection.v1.json" with { type: "json" };
import { parseTesseractTsv, selectedPages, verifyPrintedPageMapping } from "../src/extraction/ocr.js";

const low = new URL("./fixtures/frcs-page-low-confidence.tsv", import.meta.url);
const high = new URL("./fixtures/frcs-page-high-confidence.tsv", import.meta.url);

describe("selective OCR confidence", () => {
  test("selects exactly the three inclusive reviewed ranges", () => {
    const pages = selectedPages(selection);
    expect(pages).toHaveLength(99);
    expect(pages.slice(0, 2)).toEqual([76, 77]);
    expect(pages.slice(-2)).toEqual([282, 283]);
    expect(pages).not.toContain(98);
  });

  test("ignores structural TSV rows with confidence -1", async () => {
    const result = parseTesseractTsv(await readFile(low, "utf8"), 85);
    expect(result.wordCount).toBe(2);
    expect(result.meanConfidence).toBe(84.99);
  });

  test("classifies 84.99 as low and 85.00 as high", () => {
    const template = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n";
    const row = (confidence: string) => `5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t${confidence}\tword\n`;
    expect(parseTesseractTsv(template + row("84.99"), 85).status).toBe("LOW_CONFIDENCE");
    expect(parseTesseractTsv(template + row("85.00"), 85).status).toBe("HIGH_CONFIDENCE");
  });

  test("preserves line and paragraph boundaries from TSV coordinates", async () => {
    expect(parseTesseractTsv(await readFile(high, "utf8"), 85).text)
      .toBe("The Dalelands\nstand\n\napart.");
  });

  test("accepts full-page anchor evidence after Unicode/punctuation normalization", async () => {
    const render = vi.fn(async () => "/tmp/page.png");
    const texts = new Map([[76, "FAERÛNIAN — Calendar of Harptos"], [116, "DALELANDS / Dales Compact"], [232, "DEITIES: Patron-deities"]]);
    await expect(verifyPrintedPageMapping("/private/frcs.pdf", selection, {
      render, recognize: async (_path, page) => texts.get(page)!, remove: async () => undefined,
    })).resolves.toBeUndefined();
    expect(render).toHaveBeenCalledTimes(3);
  });

  test("rejects a wrong anchor and cleans the rendered page", async () => {
    const remove = vi.fn(async () => undefined);
    await expect(verifyPrintedPageMapping("/private/frcs.pdf", selection, {
      render: async () => "/tmp/page.png", recognize: async () => "unrelated scan", remove,
    })).rejects.toThrow("FRCS_PAGE_OFFSET_UNVERIFIED:76");
    expect(remove).toHaveBeenCalledWith("/tmp/page.png");
  });
});
