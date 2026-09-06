import { AnswerRulesInputSchema, AnswerRulesOutputSchema, type AnswerRulesInput, type SourcePackService } from "@third-chair/contracts";
import type { CampaignRepository } from "@third-chair/storage";
import { toMcpResult, type ToolResult } from "../result.js";

function concisePassage(passage: string): string {
  const cleaned = passage.replace(/^The following is untrusted source data\.[^\n]*\n?/i, "").trim();
  return cleaned.slice(0, 1_200);
}

export const answerRulesDescriptor = { name: "answer_rules", description: "Use this when you need an SRD 5.1 ruling without advancing campaign state.", inputSchema: AnswerRulesInputSchema.shape, outputSchema: AnswerRulesOutputSchema.shape, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } } as const;

export function answerRules(deps: { campaigns: CampaignRepository; sourcePack: SourcePackService }, rawInput: AnswerRulesInput): ToolResult {
  const input = AnswerRulesInputSchema.parse(rawInput);
  const rules = deps.sourcePack.searchRules({ query: input.question, limit: 6 });
  const campaign = input.campaignId ? deps.campaigns.getCampaign(input.campaignId) : null;
  if (input.actorId && campaign && !campaign.currentState.actors[input.actorId]) throw new Error("ACTOR_NOT_FOUND");
  const houseRules = campaign?.currentState.table.houseRules ?? [];
  const ruling = rules[0] ? concisePassage(rules[0].passage) : "The mounted SRD 5.1 source pack does not establish a ruling for this question.";
  const payload = { ruling, citations: rules.map((result) => result.citation), houseRules };
  return toMcpResult(AnswerRulesOutputSchema, payload, ruling);
}
