import { RecallKnownLoreInputSchema, RecallKnownLoreOutputSchema, type RecallKnownLoreInput, type SourcePackService } from "@third-chair/contracts";
import { projectPlayerView } from "@third-chair/engine";
import type { CampaignRepository } from "@third-chair/storage";
import { toMcpResult, type ToolResult } from "../result.js";

export const recallKnownLoreDescriptor = { name: "recall_known_lore", description: "Use this when a player asks what one of their actors already knows about established people, places, or factions.", inputSchema: RecallKnownLoreInputSchema.shape, outputSchema: RecallKnownLoreOutputSchema.shape, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } } as const;

export function recallKnownLore(deps: { campaigns: CampaignRepository; sourcePack: SourcePackService }, rawInput: RecallKnownLoreInput): ToolResult {
  const input = RecallKnownLoreInputSchema.parse(rawInput);
  const campaign = deps.campaigns.getCampaign(input.campaignId);
  const actor = campaign.currentState.actors[input.actorId];
  if (!actor || (actor.controller !== "BILL" && actor.controller !== "RAVEN")) throw new Error("PLAYER_ACTOR_NOT_FOUND");
  const view = projectPlayerView(campaign.currentState, actor.controller);
  const normalizedQuestion = input.question.toLocaleLowerCase();
  const knownEntities = [view.location, ...view.npcs, ...view.factions, ...view.openThreads];
  const entityIds = [...new Set(knownEntities
    .filter((entity) => normalizedQuestion.includes(entity.name.toLocaleLowerCase()))
    .map(({ id }) => id))];
  const results = entityIds.length === 0 ? [] : deps.sourcePack.searchLore({ query: input.question, asOfDr: 1375, entityIds, limit: 8 });
  const payload = { actorId: input.actorId, results };
  return toMcpResult(RecallKnownLoreOutputSchema, payload, results.length ? `Known lore found: ${results.length} result${results.length === 1 ? "" : "s"}.` : "No established lore is available to that actor.");
}
