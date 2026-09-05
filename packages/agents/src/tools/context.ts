import type { RunContext } from "@openai/agents";
import {
  SourceCitationSchema, SourceResultSchema, TimelineResultSchema,
  type ActorIntent, type CheckResolution, type PersistedId, type ResolutionPlan,
  type SourceCitation, type SourcePackService,
} from "@third-chair/contracts";
import { z } from "zod";
import { serializeSourceRecords } from "../context/serialize.js";

type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

/** Local runtime capabilities; never included in model-visible tool results. */
export interface DirectorRunContext {
  turnId: PersistedId;
  campaignId: PersistedId;
  sourcePack: SourcePackService;
  intentsLocked: boolean;
  readonly lockedIntents: DeepReadonly<ActorIntent[]>;
  abortSignal: AbortSignal;
  lockAndResolveChecks(plan: ResolutionPlan): LockAndResolveResult | Promise<LockAndResolveResult>;
}

export interface LockAndResolveResult {
  planId: ResolutionPlan["id"];
  resolutions: readonly CheckResolution[];
  nextRngCounter: number;
  reused: boolean;
}

export const QuerySchema = z.string().trim().min(1).max(2_000);
export const FilterSchema = z.string().trim().min(1).max(200);
export const FilterListSchema = z.array(FilterSchema).max(20);
export const LimitSchema = z.number().int().min(0).max(100);
export const DateSchema = z.number().int().min(-100_000).max(1375);
const CitationSchema = SourceCitationSchema.strict();
export const StrictSourceResultSchema = SourceResultSchema.extend({ citation: CitationSchema }).strict();
export const StrictTimelineResultSchema = TimelineResultSchema.extend({ citation: CitationSchema }).strict();
export const RetrievalOutputSchema = z.object({
  citations: z.array(CitationSchema).max(20),
  untrustedData: z.string(),
}).strict();

export const retrievalPolicy = {
  strict: true,
  outputSchema: RetrievalOutputSchema,
  timeoutMs: 5_000,
  timeoutBehavior: "raise_exception",
  errorFunction: null,
} as const;

export function retrievalContext(runContext?: RunContext<DirectorRunContext>): DirectorRunContext {
  if (!runContext) throw new Error("DIRECTOR_CONTEXT_REQUIRED");
  runContext.context.abortSignal.throwIfAborted();
  return runContext.context;
}

/** Only validated service records and their citations may cross this boundary. */
export function retrievalOutput(records: readonly unknown[], citations: SourceCitation[]) {
  return RetrievalOutputSchema.parse({ citations, untrustedData: serializeSourceRecords(records) });
}
