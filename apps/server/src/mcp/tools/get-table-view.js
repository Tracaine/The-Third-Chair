import { PersistedIdSchema, PlayerViewSchema } from "@third-chair/contracts";
import { projectPlayerView } from "@third-chair/engine";
import { playerResult } from "../result.js";
export const getTableViewDescriptor = { name: "get_table_view", description: "Use this when you need the current player-safe table state.", inputSchema: { campaignId: PersistedIdSchema }, outputSchema: PlayerViewSchema.shape, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } };
export function getTableView(deps, input) {
    const campaignId = PersistedIdSchema.parse(input.campaignId);
    const view = projectPlayerView(deps.campaigns.getCampaign(campaignId).currentState, "RAVEN");
    return playerResult(`Table state: version ${view.stateVersion}.`, view, { cardOrder: ["location", "actors", "currentDecision"] });
}
//# sourceMappingURL=get-table-view.js.map