import {
  CampaignCreationRequestSchema,
  CampaignSettingSchema,
  CharacterDraftSchema,
  CreateCampaignOutputSchema,
  QuickstartCampaignSchema,
  PlayerSeatSchema,
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
  audience: PlayerSeatSchema.default("RAVEN"),
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
  description: "Use this when Bill wants to begin a new Third Chair adventure. For a quickstart, have Bill choose his own named archetype and let Raven independently choose hers: STALWART_FIGHTER, CUNNING_ROGUE, ARCANE_SCHOLAR, or DAWN_CLERIC. The server supplies complete level-one sheets, binds the installed source pack, and generates a hidden campaign spine. Present visibleOpening before asking for either action. For render_table, reuse the returned audience and playerViewId together. Use the advanced character fields only when both players want full manual creation.",
  inputSchema: CreateCampaignToolInputSchema.shape,
  outputSchema: CreateCampaignOutputSchema.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
} as const;

export async function createCampaign(
  deps: { campaignCreator: CampaignBuilder; sourcePack: Pick<SourcePackService, "manifest" | "characterOptions">; ownerId: string },
  rawInput: unknown,
): Promise<ToolResult> {
  const supplied = CreateCampaignToolInputSchema.parse(rawInput);
  const quickstart = supplied.quickstart;
  const sourced = quickstart !== undefined && (deps.sourcePack.characterOptions?.().length ?? 0) > 0;
  const input = CampaignCreationRequestSchema.parse({
    requestId: supplied.requestId,
    ownerId: supplied.ownerId ?? deps.ownerId,
    campaignName: supplied.campaignName,
    tone: supplied.tone,
    boundaries: supplied.boundaries,
    sourcePackHash: supplied.sourcePackHash ?? deps.sourcePack.manifest().sourcePackManifestHash,
    setting: supplied.setting ?? { region: "Dalelands", startDateDr: 1375 },
    creationMode: quickstart ? "QUICKSTART" : "ADVANCED",
    billCharacter: quickstart ? quickstartCharacterDraft(quickstart.billCharacter, "BILL", sourced) : supplied.billCharacter,
    ravenCharacter: quickstart ? quickstartCharacterDraft(quickstart.ravenCharacter, "RAVEN", sourced) : supplied.ravenCharacter,
  });
  const result = await deps.campaignCreator.create(input);
  const decision = result.currentDecision;
  const ownsDecision = decision.owner === "BOTH" || decision.owner === supplied.audience;
  const currentDecision = ownsDecision ? decision : {
    id: decision.id, stateVersion: decision.stateVersion, mode: decision.mode, owner: decision.owner, situation: decision.situation,
  };
  const payload = {
    campaignId: result.campaignId,
    sourcePackHash: result.sourcePackHash,
    visibleOpening: result.visibleOpening,
    characters: result.characters,
    currentDecision,
    audience: supplied.audience,
    playerViewId: computePlayerViewId(result.campaignId, result.currentDecision.stateVersion, supplied.audience, result.stateHash),
  };
  return toMcpResult(CreateCampaignOutputSchema, payload, result.visibleOpening);
}
