import {
  CampaignCreationRequestSchema,
  CampaignSettingSchema,
  CharacterDraftSchema,
  CreateCampaignOutputSchema,
  QuickstartCampaignSchema,
  type SourcePackService,
} from "@third-chair/contracts";
import { quickstartCharacterDraft, type CampaignBuilder } from "@third-chair/engine";
import { z } from "zod";
import { toMcpResult, type ToolResult } from "../result.js";
import { computePlayerViewId } from "./get-table-view.js";

export const CreateCampaignToolInputSchema = z.object({
  requestId: CampaignCreationRequestSchema.shape.requestId,
  ownerId: CampaignCreationRequestSchema.shape.ownerId.optional(),
  campaignName: CampaignCreationRequestSchema.shape.campaignName,
  tone: CampaignCreationRequestSchema.shape.tone,
  boundaries: CampaignCreationRequestSchema.shape.boundaries,
  quickstart: QuickstartCampaignSchema.optional(),
  sourcePackHash: CampaignCreationRequestSchema.shape.sourcePackHash.optional(),
  setting: CampaignSettingSchema.optional(),
  billCharacter: CharacterDraftSchema.optional(),
  ravenCharacter: CharacterDraftSchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.quickstart && (input.billCharacter || input.ravenCharacter)) {
    context.addIssue({ code: "custom", path: ["quickstart"], message: "CAMPAIGN_CREATION_MODE_CONFLICT" });
  }
});

export const createCampaignDescriptor = {
  name: "create_campaign",
  description: "Use this when Bill wants to begin a new Third Chair adventure. For a quickstart, have Bill choose his own named archetype and let Raven independently choose hers: STALWART_FIGHTER, CUNNING_ROGUE, ARCANE_SCHOLAR, or DAWN_CLERIC. The server supplies complete level-one sheets, binds the installed source pack, and creates the hidden campaign spine. Use the advanced character fields only when both players want full manual creation.",
  inputSchema: CreateCampaignToolInputSchema.shape,
  outputSchema: CreateCampaignOutputSchema.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
} as const;

export async function createCampaign(
  deps: { campaignCreator: CampaignBuilder; sourcePack: Pick<SourcePackService, "manifest">; ownerId: string },
  rawInput: unknown,
): Promise<ToolResult> {
  const supplied = CreateCampaignToolInputSchema.parse(rawInput);
  const quickstart = supplied.quickstart;
  const input = CampaignCreationRequestSchema.parse({
    requestId: supplied.requestId,
    ownerId: supplied.ownerId ?? deps.ownerId,
    campaignName: supplied.campaignName,
    tone: supplied.tone,
    boundaries: supplied.boundaries,
    sourcePackHash: supplied.sourcePackHash ?? deps.sourcePack.manifest().sourcePackManifestHash,
    setting: supplied.setting ?? { region: "Dalelands", startDateDr: 1375 },
    creationMode: quickstart ? "QUICKSTART" : "ADVANCED",
    billCharacter: quickstart ? quickstartCharacterDraft(quickstart.billCharacter, "BILL") : supplied.billCharacter,
    ravenCharacter: quickstart ? quickstartCharacterDraft(quickstart.ravenCharacter, "RAVEN") : supplied.ravenCharacter,
  });
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
