export type ContentKind = "MECHANICS" | "LORE" | "TIMELINE";
export type ConfidenceStatus = "NATIVE_TEXT" | "REVIEWED" | "HIGH_CONFIDENCE" | "LOW_CONFIDENCE";

export interface SourceDocumentRecord {
  id: string;
  title: string;
  sha256: string;
  pageCount: number;
  edition: string;
  extractionMethod: string;
  permittedKinds: ContentKind[];
}

export interface SourceChunk {
  id: string;
  documentId: string;
  pageStart: number;
  pageEnd: number;
  headingPath: string[];
  edition: string;
  contentKind: ContentKind;
  region?: string;
  dateStartDr?: number;
  dateEndDr?: number;
  ocrConfidence?: number;
  confidenceStatus: ConfidenceStatus;
  text: string;
  textSha256: string;
  aliases?: string[];
  containsEditionMechanics?: boolean;
}

export interface RuleSection { id: string; chunkId: string; ruleKey: string; category: string }
export interface TimelineEvent { id: string; yearStartDr: number; yearEndDr: number; precision: "EXACT" | "CIRCA" | "RANGE"; summary: string; chunkId: string }
export interface TimelineEdge { fromEventId: string; toEventId: string; edgeType: "CHRONOLOGICAL_NEXT" | "CHRONOLOGICAL_PREVIOUS" | "EXPLICIT_REFERENCE" }
export interface EntityRecord { id: string; canonicalName: string; entityType: string; region?: string; validFromDr?: number; validToDr?: number; aliases: string[] }
