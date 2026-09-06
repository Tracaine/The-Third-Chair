import { RenderTableInputSchema, TableViewPayloadSchema, type RenderTableInput } from "@third-chair/contracts";
import { projectPlayerView } from "@third-chair/engine";
import { NarrationSchema } from "@third-chair/engine";
import type { CampaignRepository, TurnRepository } from "@third-chair/storage";
import { toMcpResult, type ToolResult } from "../result.js";
import { computePlayerViewId } from "./get-table-view.js";
import { TABLE_WIDGET_URI } from "../widget-resource.js";

export class StalePlayerViewError extends Error {
  readonly code = "STALE_PLAYER_VIEW";
  constructor(readonly currentStateVersion: number, readonly freshPlayerViewId: string) {
    super(`STALE_PLAYER_VIEW: current state version is ${currentStateVersion}`);
  }
}

export const renderTableDescriptor = {
  name: "render_table",
  title: "Render Raven's Table",
  description: "Use this when you need to attach or refresh Raven's persistent table from a current player view.",
  inputSchema: RenderTableInputSchema.shape,
  outputSchema: TableViewPayloadSchema.shape,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  _meta: {
    ui: { resourceUri: TABLE_WIDGET_URI },
    "openai/outputTemplate": TABLE_WIDGET_URI,
    "openai/toolInvocation/invoking": "Setting the table…",
    "openai/toolInvocation/invoked": "The table is ready",
  },
} as const;

export function renderTable(deps: { campaigns: CampaignRepository; turns: TurnRepository }, rawInput: RenderTableInput): ToolResult {
  const input = RenderTableInputSchema.parse(rawInput);
  const campaign = deps.campaigns.getCampaign(input.campaignId);
  const freshPlayerViewId = computePlayerViewId(campaign.id, campaign.stateVersion, input.audience, campaign.currentStateHash);
  if (freshPlayerViewId !== input.playerViewId) throw new StalePlayerViewError(campaign.stateVersion, freshPlayerViewId);
  const playerView = projectPlayerView(campaign.currentState, input.audience);
  const recentTurns = deps.turns.listRecentCommitted(campaign.id, 100);
  const newestVisibleChecks = recentTurns.flatMap((turn) => {
    const narrationValue = turn.narration;
    const sceneText = NarrationSchema.shape.sceneText.safeParse(
      narrationValue !== null && typeof narrationValue === "object" && "sceneText" in narrationValue
        ? narrationValue.sceneText
        : undefined,
    );
    let consequenceAvailable = sceneText.success;
    return [...(turn.resolutions ?? [])].reverse().flatMap((resolution) => {
      if (resolution.visibility !== "PUBLIC") return [];
      const visible = consequenceAvailable
        ? { ...resolution, consequence: sceneText.data }
        : resolution;
      consequenceAvailable = false;
      return [visible];
    });
  }).slice(0, 6).reverse();
  const latestMutation = recentTurns[0];
  const payload = {
    playerViewId: freshPlayerViewId,
    audience: input.audience,
    playerView,
    visibleChecks: newestVisibleChecks,
    ...(latestMutation ? { lastMutationId: latestMutation.id } : {}),
    serverStatus: "READY" as const,
  };
  return toMcpResult(TableViewPayloadSchema, payload, `Raven's Table is ready at state version ${campaign.stateVersion}.`, {
    ui: { resourceUri: TABLE_WIDGET_URI },
    "openai/outputTemplate": TABLE_WIDGET_URI,
    accessibleLabel: "Raven's Table",
  });
}
