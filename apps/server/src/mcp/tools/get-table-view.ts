import { GetTableViewInputSchema, GetTableViewOutputSchema, type GetTableViewInput } from "@third-chair/contracts";
import type { CampaignRepository } from "@third-chair/storage";
import { projectPlayerView, sha256Json } from "@third-chair/engine";
import { toMcpResult, type ToolResult } from "../result.js";

export function computePlayerViewId(campaignId: string, stateVersion: number, audience: "BILL" | "RAVEN", stateHash: string): string {
  return sha256Json([campaignId, stateVersion, audience, stateHash]);
}

export const getTableViewDescriptor = { name: "get_table_view", description: "Use this when you need the current authoritative player-safe table state.", inputSchema: GetTableViewInputSchema.shape, outputSchema: GetTableViewOutputSchema.shape, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } } as const;
export function getTableView(deps: { campaigns: CampaignRepository }, rawInput: GetTableViewInput): ToolResult {
  const input = GetTableViewInputSchema.parse(rawInput);
  const campaign = deps.campaigns.getCampaign(input.campaignId);
  const view = projectPlayerView(campaign.currentState, input.audience);
  const payload = { playerViewId: computePlayerViewId(campaign.id, campaign.stateVersion, input.audience, campaign.currentStateHash), view };
  return toMcpResult(GetTableViewOutputSchema, payload, `Table state: version ${view.stateVersion}.`, { panelOrder: ["location", "actors", "currentDecision"], accessibleLabel: "Current Third Chair table" });
}
