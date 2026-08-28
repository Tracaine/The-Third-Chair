import { createHash } from "node:crypto";
import type { SourceChunk } from "../indexing/types.js";
import type { OcrPage } from "../extraction/ocr.js";
import { slugHeading } from "./headings.js";

const headings = new Map([
  ["LIFE IN FAERUN", "Life in Faerun"], ["LIFE IN FAERÛN", "Life in Faerun"],
  ["THE DALELANDS", "The Dalelands"], ["DALELANDS", "The Dalelands"],
  ["DEITIES", "Deities"], ["HISTORY", "History"], ["ORGANIZATIONS", "Organizations"],
]);
const mechanics = [
  /\bprestige class\s*:/i, /\bfeat\s*:/i, /\bspell level\s*:/i,
  /\b(?:armor class|ac)\s*:\s*[+]?\d|[+]\d+\s+armor bonus/i,
];

export function classifyRulesShapedLore(text: string): boolean { return mechanics.some((pattern) => pattern.test(text)); }

export function parseFrcsPages(pages: readonly OcrPage[]): {
  chunks: SourceChunk[]; diagnostics: Array<{ page: number; textSha256: string; containsEditionMechanics: true }>;
} {
  const chunks: SourceChunk[] = []; const diagnostics: Array<{ page: number; textSha256: string; containsEditionMechanics: true }> = [];
  let section = "Life in Faerun";
  for (const page of pages) {
    let paragraphOrdinal = 0;
    const paragraphs = page.text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).flatMap((paragraph) => {
      const lines = paragraph.split("\n");
      const first = lines[0]?.trim() ?? ""; const known = headings.get(first.toUpperCase());
      if (!known) return [paragraph.trim()].filter(Boolean);
      section = known; return [lines.slice(1).join("\n").trim()].filter(Boolean);
    });
    for (const paragraph of paragraphs) {
      paragraphOrdinal += 1;
      const textSha256 = createHash("sha256").update(paragraph).digest("hex");
      if (classifyRulesShapedLore(paragraph)) { diagnostics.push({ page: page.page, textSha256, containsEditionMechanics: true }); continue; }
      const id = `frcs-3e:${page.page}:${slugHeading(section)}:${paragraphOrdinal}:${textSha256.slice(0, 12)}`;
      chunks.push({ id, documentId: "frcs-3e", pageStart: page.page, pageEnd: page.page, headingPath: [section],
        edition: "FRCS_3E_LORE_ONLY", contentKind: "LORE",
        ...(section === "The Dalelands" ? { region: "Dalelands" } : {}),
        ocrConfidence: page.meanConfidence, confidenceStatus: page.status, text: paragraph, textSha256 });
    }
  }
  return { chunks, diagnostics };
}
