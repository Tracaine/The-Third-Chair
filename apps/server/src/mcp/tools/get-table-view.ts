import { PersistedIdSchema, PlayerViewSchema } from "@third-chair/contracts";
import type { CampaignRepository } from "@third-chair/storage";
import { projectPlayerView } from "@third-chair/engine";
import { playerResult, type ToolResult } from "../result.js";
export const getTableViewDescriptor = { name: "get_table_view", description: "Use this when you need the current player-safe table state.", inputSchema: { campaignId: PersistedIdSchema }, outputSchema: PlayerViewSchema.shape, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } } as const;
export function getTableView(deps: { campaigns: CampaignRepository }, input: { campaignId: string }): ToolResult {
  const campaignId = PersistedIdSchema.parse(input.campaignId);
  const view = projectPlayerView(deps.campaigns.getCampaign(campaignId).currentState, "RAVEN");
  return playerResult(`Table state: version ${view.stateVersion}.`, view, { cardOrder: ["location", "actors", "currentDecision"] });
}
