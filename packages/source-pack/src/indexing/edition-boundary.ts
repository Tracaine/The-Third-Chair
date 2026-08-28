import type { SourceChunk } from "./types.js";

export function assertMechanicalAuthority(chunk: Pick<SourceChunk, "documentId" | "edition" | "contentKind">): boolean {
  return chunk.documentId === "srd-5.1" && chunk.edition === "SRD_5_1" && chunk.contentKind === "MECHANICS";
}

export function filterMechanicalAuthority(chunks: readonly SourceChunk[]): SourceChunk[] {
  return chunks.filter(assertMechanicalAuthority);
}
