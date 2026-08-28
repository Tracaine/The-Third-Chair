import { z } from "zod";

export const SourceCitationSchema = z.object({
  documentId: z.string(), title: z.string(), pageStart: z.number().int().positive(), pageEnd: z.number().int().positive(),
  headingPath: z.array(z.string()), edition: z.string(),
});
export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const SourceResultSchema = z.object({
  kind: z.enum(["RULE", "LORE"]), id: z.string(), passage: z.string(), citation: SourceCitationSchema,
  confidenceStatus: z.enum(["NATIVE_TEXT", "REVIEWED", "HIGH_CONFIDENCE", "LOW_CONFIDENCE"]),
});
export type SourceResult = z.infer<typeof SourceResultSchema>;

export const TimelineResultSchema = z.object({
  kind: z.literal("TIMELINE"), id: z.string(), yearStartDr: z.number().int(), yearEndDr: z.number().int(),
  precision: z.enum(["EXACT", "CIRCA", "RANGE"]), summary: z.string(), citation: SourceCitationSchema,
});
export type TimelineResult = z.infer<typeof TimelineResultSchema>;

export const EntityResultSchema = z.object({
  id: z.string(), canonicalName: z.string(), entityType: z.string(), region: z.string().optional(), aliases: z.array(z.string()),
});
export type EntityResult = z.infer<typeof EntityResultSchema>;

export interface SourcePackManifestView { sourcePackManifestHash: string; [key: string]: unknown }

export interface SourcePackService {
  searchRules(input: { query: string; ruleKeys?: string[]; limit?: number }): SourceResult[];
  searchLore(input: { query: string; region?: string; asOfDr?: number; entityIds?: string[]; limit?: number }): SourceResult[];
  searchTimeline(input: { query?: string; entityIds?: string[]; fromDr?: number; toDr?: number; limit?: number }): TimelineResult[];
  getEntity(input: { nameOrAlias: string; asOfDr?: number }): EntityResult | null;
  manifest(): SourcePackManifestView;
}
