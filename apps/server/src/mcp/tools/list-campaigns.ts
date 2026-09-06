import { ListCampaignsInputSchema, ListCampaignsOutputSchema, type ListCampaignsInput } from "@third-chair/contracts";
import { projectPlayerView } from "@third-chair/engine";
import type { CampaignRepository } from "@third-chair/storage";
import { toMcpResult, type ToolResult } from "../result.js";

export const listCampaignsDescriptor = { name: "list_campaigns", description: "Use this when you need to list persistent Third Chair campaigns and their visible current status.", inputSchema: ListCampaignsInputSchema.shape, outputSchema: ListCampaignsOutputSchema.shape, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } } as const;

export function listCampaigns(deps: { campaigns: CampaignRepository }, rawInput: ListCampaignsInput): ToolResult {
  const input = ListCampaignsInputSchema.parse(rawInput);
  const campaigns = deps.campaigns.listCampaigns().map((campaign) => {
    const view = projectPlayerView(campaign.currentState, input.audience);
    return {
      id: campaign.id,
      name: campaign.name,
      worldDate: view.worldDate,
      location: view.location,
      stateVersion: view.stateVersion,
      decisionOwner: view.currentDecision.owner,
      decisionMode: view.currentDecision.mode,
      status: campaign.status,
      lastCommittedAt: campaign.updatedAt,
    };
  });
  return toMcpResult(ListCampaignsOutputSchema, { campaigns }, `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} found.`);
}
