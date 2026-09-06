import { CampaignCreationRequestSchema, CreateCampaignOutputSchema, type CampaignCreationRequest } from "@third-chair/contracts";
import type { CampaignBuilder } from "@third-chair/engine";
import { toMcpResult, type ToolResult } from "../result.js";
import { computePlayerViewId } from "./get-table-view.js";

export const createCampaignDescriptor = {
  name: "create_campaign",
  description: "Use this when you need to create one persistent Third Chair campaign from Bill's and Raven's supplied level-one choices, the bound private source pack, and a hidden three-route spine.",
  inputSchema: CampaignCreationRequestSchema.shape,
  outputSchema: CreateCampaignOutputSchema.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
} as const;

export async function createCampaign(
  deps: { campaignCreator: CampaignBuilder },
  rawInput: CampaignCreationRequest,
): Promise<ToolResult> {
  const input = CampaignCreationRequestSchema.parse(rawInput);
  const result = await deps.campaignCreator.create(input);
  const payload = {
    campaignId: result.campaignId,
    sourcePackHash: result.sourcePackHash,
    visibleOpening: result.visibleOpening,
    characters: result.characters,
    currentDecision: result.currentDecision,
    playerViewId: computePlayerViewId(result.campaignId, 0, "RAVEN", result.stateHash),
  };
  return toMcpResult(CreateCampaignOutputSchema, payload, result.visibleOpening);
}
