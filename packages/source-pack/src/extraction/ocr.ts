import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { runProcess, type ProcessResult } from "../process.js";
import type { ConfidenceStatus } from "../indexing/types.js";

export interface SelectionRange {
  id: string; pdfStart: number; pdfEnd: number; printedStart: number; printedEnd: number; mappingAnchors: string[];
}
export interface FrcsSelection { confidenceThreshold: number; ranges: SelectionRange[] }
export interface OcrPage { page: number; text: string; meanConfidence: number; status: Extract<ConfidenceStatus, "HIGH_CONFIDENCE" | "LOW_CONFIDENCE">; wordCount?: number }

export function selectedPages(selection: FrcsSelection): number[] {
  return selection.ranges.flatMap((range) => Array.from({ length: range.pdfEnd - range.pdfStart + 1 }, (_, index) => range.pdfStart + index));
}

export function parseTesseractTsv(tsv: string, threshold: number): Omit<OcrPage, "page"> {
  const rows = tsv.replace(/\r\n?/g, "\n").split("\n");
  const header = rows.shift()?.split("\t") ?? [];
  const index = Object.fromEntries(header.map((name, position) => [name, position])) as Record<string, number>;
  const words: Array<{ block: string; paragraph: string; line: string; word: number; confidence: number; text: string }> = [];
  for (const row of rows) {
    if (!row.trim()) continue;
    const fields = row.split("\t");
    const confidence = Number(fields[index.conf ?? -1]);
    const text = fields[index.text ?? -1]?.trim() ?? "";
    if (!Number.isFinite(confidence) || confidence < 0 || !text) continue;
    words.push({ block: fields[index.block_num ?? -1] ?? "0", paragraph: fields[index.par_num ?? -1] ?? "0",
      line: fields[index.line_num ?? -1] ?? "0", word: Number(fields[index.word_num ?? -1] ?? 0), confidence, text });
  }
  const meanConfidence = words.length === 0 ? 0 : Math.round(words.reduce((sum, word) => sum + word.confidence, 0) / words.length * 100) / 100;
  const paragraphs: string[] = [];
  let paragraphKey = ""; let lineKey = ""; let lines: string[] = []; let lineWords: string[] = [];
  const flushLine = () => { if (lineWords.length) lines.push(lineWords.join(" ")); lineWords = []; };
  const flushParagraph = () => { flushLine(); if (lines.length) paragraphs.push(lines.join("\n")); lines = []; };
  for (const word of words) {
    const nextParagraph = `${word.block}:${word.paragraph}`; const nextLine = `${nextParagraph}:${word.line}`;
    if (paragraphKey && nextParagraph !== paragraphKey) flushParagraph();
    else if (lineKey && nextLine !== lineKey) flushLine();
    paragraphKey = nextParagraph; lineKey = nextLine; lineWords.push(word.text);
  }
  flushParagraph();
  return { text: paragraphs.join("\n\n"), meanConfidence, status: meanConfidence >= threshold ? "HIGH_CONFIDENCE" : "LOW_CONFIDENCE", wordCount: words.length };
}

function normalizeEvidence(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

interface MappingDependencies {
  render(pdfPath: string, page: number): Promise<string>;
  recognize(imagePath: string, page: number): Promise<string>;
  remove(path: string): Promise<void>;
}

async function defaultRender(pdfPath: string, page: number, directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const base = join(directory, `anchor-${page}`);
  await runProcess("pdftoppm", ["-f", String(page), "-l", String(page), "-r", "300", "-png", "-singlefile", pdfPath, base]);
  return `${base}.png`;
}

async function defaultRecognize(imagePath: string): Promise<string> {
  const { stdout } = await runProcess("tesseract", [imagePath, "stdout", "--psm", "6", "tsv"]);
  return parseTesseractTsv(stdout, 0).text;
}

export async function verifyPrintedPageMapping(
  pdfPath: string,
  selection: FrcsSelection,
  dependencies?: MappingDependencies,
  buildDir = "tmp/source-pack-builds/anchors",
): Promise<void> {
  const deps: MappingDependencies = dependencies ?? {
    render: (path, page) => defaultRender(path, page, buildDir),
    recognize: (path) => defaultRecognize(path),
    remove: (path) => rm(path, { force: true }),
  };
  for (const range of selection.ranges) {
    const page = range.pdfStart;
    const image = await deps.render(pdfPath, page);
    try {
      const evidence = normalizeEvidence(await deps.recognize(image, page));
      if (!range.mappingAnchors.every((anchor) => evidence.includes(normalizeEvidence(anchor)))) {
        throw new Error(`FRCS_PAGE_OFFSET_UNVERIFIED:${page}`);
      }
    } finally { await deps.remove(image); }
  }
}

export function ocrmypdfArguments(source: string, output: string, sidecar: string): string[] {
  return ["--pages", "76-97,116-140,232-283", "--deskew", "--rotate-pages", "--skip-text", "--sidecar", sidecar, source, output];
}

export async function runSelectiveOcr(
  source: string,
  selection: FrcsSelection,
  buildDir: string,
  dependencies: { run(command: string, args: readonly string[]): Promise<ProcessResult> } = { run: runProcess },
): Promise<OcrPage[]> {
  await verifyPrintedPageMapping(source, selection, undefined, join(buildDir, "anchors"));
  const output = join(buildDir, "frcs.ocr.pdf"); const sidecar = join(buildDir, "frcs.sidecar.txt");
  await dependencies.run("ocrmypdf", ocrmypdfArguments(source, output, sidecar));
  const pages: OcrPage[] = [];
  for (const page of selectedPages(selection)) {
    const image = await defaultRender(output, page, join(buildDir, "pages"));
    try {
      const { stdout } = await dependencies.run("tesseract", [image, "stdout", "--psm", "1", "tsv"]);
      pages.push({ page, ...parseTesseractTsv(stdout, selection.confidenceThreshold) });
    } finally { await rm(image, { force: true }); }
  }
  await rm(output, { force: true });
  return pages;
}
