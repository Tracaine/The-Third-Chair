import type { CampaignArchiveRepository, CampaignRepository, CheckpointRepository, ExportRepository, TurnRepository } from "@third-chair/storage";
import type { CampaignBuilder, TurnEngine } from "@third-chair/engine";
import type { SourcePackService } from "@third-chair/contracts";
import { McpServer as SdkMcpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { advanceGame, advanceGameDescriptor } from "./tools/advance-game.js";
import { getTableView, getTableViewDescriptor } from "./tools/get-table-view.js";
import { listCampaigns, listCampaignsDescriptor } from "./tools/list-campaigns.js";
import { answerRules, answerRulesDescriptor } from "./tools/answer-rules.js";
import { recallKnownLore, recallKnownLoreDescriptor } from "./tools/recall-known-lore.js";
import { renderTable, renderTableDescriptor } from "./tools/render-table.js";
import { createCampaign, createCampaignDescriptor } from "./tools/create-campaign.js";
import { createCheckpoint, createCheckpointDescriptor } from "./tools/create-checkpoint.js";
import { rewindToCheckpoint, rewindToCheckpointDescriptor } from "./tools/rewind-to-checkpoint.js";
import { exportCampaign, exportCampaignDescriptor, EXPORT_MIME_TYPE } from "./tools/export-campaign.js";
import { EXPORT_RESOURCE_TEMPLATE, loadExportResource } from "./export-resource.js";
import { loadWidgetResource, TABLE_WIDGET_URI, type WidgetResource } from "./widget-resource.js";
export interface McpServer { readonly tools: readonly { readonly name: string; readonly description: string; readonly inputSchema: unknown; readonly outputSchema: unknown; readonly annotations: object }[]; invoke(name: string, input: unknown): Promise<unknown>; }
type ServerDependencies = { campaigns: CampaignRepository; turns: TurnRepository; engine: TurnEngine; checkpoints?: CheckpointRepository; sourcePack?: SourcePackService; campaignCreator?: CampaignBuilder; archives?: CampaignArchiveRepository; exports?: ExportRepository; exportDirectory?: string; resourceOwnerId?: string };
function requireSourcePack(deps: ServerDependencies): SourcePackService { if (!deps.sourcePack) throw new Error("SOURCE_PACK_REQUIRED"); return deps.sourcePack; }
function requireCampaignCreator(deps: ServerDependencies): CampaignBuilder { if (!deps.campaignCreator) throw new Error("CAMPAIGN_CREATOR_REQUIRED"); return deps.campaignCreator; }
function requireCheckpoints(deps: ServerDependencies): CheckpointRepository { if (!deps.checkpoints) throw new Error("CHECKPOINT_REPOSITORY_REQUIRED"); return deps.checkpoints; }
function exportDependencies(deps: ServerDependencies) {
  if (!deps.archives || !deps.exports || !deps.exportDirectory) throw new Error("EXPORT_DEPENDENCIES_REQUIRED");
  return { archives: deps.archives, exports: deps.exports, exportDirectory: deps.exportDirectory };
}
export function createMcpServer(deps: ServerDependencies): McpServer {
  return { tools: [listCampaignsDescriptor, createCampaignDescriptor, getTableViewDescriptor, advanceGameDescriptor, answerRulesDescriptor, recallKnownLoreDescriptor, createCheckpointDescriptor, rewindToCheckpointDescriptor, renderTableDescriptor, exportCampaignDescriptor], async invoke(name, input) {
    if (name === "list_campaigns") return listCampaigns(deps, input as never);
    if (name === "create_campaign") return createCampaign({ campaignCreator: requireCampaignCreator(deps) }, input as never);
    if (name === "get_table_view") return getTableView(deps, input as never);
    if (name === "advance_game") return advanceGame(deps, input);
    if (name === "answer_rules") return answerRules({ ...deps, sourcePack: requireSourcePack(deps) }, input as never);
    if (name === "recall_known_lore") return recallKnownLore({ ...deps, sourcePack: requireSourcePack(deps) }, input as never);
    if (name === "create_checkpoint") return createCheckpoint({ checkpoints: requireCheckpoints(deps) }, input as never);
    if (name === "rewind_to_checkpoint") return rewindToCheckpoint({ campaigns: deps.campaigns, checkpoints: requireCheckpoints(deps) }, input as never);
    if (name === "render_table") return renderTable(deps, input as never);
    if (name === "export_campaign") return exportCampaign(exportDependencies(deps), input as never);
    throw new Error("UNKNOWN_TOOL");
  } };
}

/** SDK registration is kept beside the in-process adapter so the same handlers own both boundaries. */
export function createSdkMcpServer(deps: ServerDependencies, widgetResource: WidgetResource = loadWidgetResource()): SdkMcpServer {
  const server = new SdkMcpServer({ name: "third-chair", version: "0.2.0" });
  server.registerTool(listCampaignsDescriptor.name, { description: listCampaignsDescriptor.description, inputSchema: listCampaignsDescriptor.inputSchema, outputSchema: listCampaignsDescriptor.outputSchema, annotations: listCampaignsDescriptor.annotations }, async (input) => listCampaigns(deps, input));
  server.registerTool(createCampaignDescriptor.name, { description: createCampaignDescriptor.description, inputSchema: createCampaignDescriptor.inputSchema, outputSchema: createCampaignDescriptor.outputSchema, annotations: createCampaignDescriptor.annotations }, async (input) => createCampaign({ campaignCreator: requireCampaignCreator(deps) }, input));
  server.registerTool(getTableViewDescriptor.name, { description: getTableViewDescriptor.description, inputSchema: getTableViewDescriptor.inputSchema, outputSchema: getTableViewDescriptor.outputSchema, annotations: getTableViewDescriptor.annotations }, async (input) => getTableView(deps, input));
  server.registerTool(advanceGameDescriptor.name, { description: advanceGameDescriptor.description, inputSchema: advanceGameDescriptor.inputSchema, outputSchema: advanceGameDescriptor.outputSchema, annotations: advanceGameDescriptor.annotations }, async (input) => advanceGame(deps, input));
  server.registerTool(answerRulesDescriptor.name, { description: answerRulesDescriptor.description, inputSchema: answerRulesDescriptor.inputSchema, outputSchema: answerRulesDescriptor.outputSchema, annotations: answerRulesDescriptor.annotations }, async (input) => answerRules({ ...deps, sourcePack: requireSourcePack(deps) }, input));
  server.registerTool(recallKnownLoreDescriptor.name, { description: recallKnownLoreDescriptor.description, inputSchema: recallKnownLoreDescriptor.inputSchema, outputSchema: recallKnownLoreDescriptor.outputSchema, annotations: recallKnownLoreDescriptor.annotations }, async (input) => recallKnownLore({ ...deps, sourcePack: requireSourcePack(deps) }, input));
  server.registerTool(createCheckpointDescriptor.name, { description: createCheckpointDescriptor.description, inputSchema: createCheckpointDescriptor.inputSchema, outputSchema: createCheckpointDescriptor.outputSchema, annotations: createCheckpointDescriptor.annotations }, async (input) => createCheckpoint({ checkpoints: requireCheckpoints(deps) }, input));
  server.registerTool(rewindToCheckpointDescriptor.name, { description: rewindToCheckpointDescriptor.description, inputSchema: rewindToCheckpointDescriptor.inputSchema, outputSchema: rewindToCheckpointDescriptor.outputSchema, annotations: rewindToCheckpointDescriptor.annotations }, async (input) => rewindToCheckpoint({ campaigns: deps.campaigns, checkpoints: requireCheckpoints(deps) }, input));
  registerAppTool(server, renderTableDescriptor.name, {
    title: renderTableDescriptor.title,
    description: renderTableDescriptor.description,
    inputSchema: renderTableDescriptor.inputSchema,
    outputSchema: renderTableDescriptor.outputSchema,
    annotations: renderTableDescriptor.annotations,
    _meta: renderTableDescriptor._meta,
  }, async (input) => renderTable(deps, input));
  server.registerTool(exportCampaignDescriptor.name, { description: exportCampaignDescriptor.description, inputSchema: exportCampaignDescriptor.inputSchema, outputSchema: exportCampaignDescriptor.outputSchema, annotations: exportCampaignDescriptor.annotations }, async (input) => exportCampaign(exportDependencies(deps), input));
  registerAppResource(server, "Raven's Table", TABLE_WIDGET_URI, {
    mimeType: widgetResource.mimeType,
    description: "Persistent player-safe Third Chair table",
  }, async () => ({ contents: [widgetResource] }));
  server.registerResource("Campaign SaveSet", new ResourceTemplate(EXPORT_RESOURCE_TEMPLATE, { list: undefined }), {
    mimeType: EXPORT_MIME_TYPE,
    description: "Expiring portable Third Chair campaign SaveSet",
  }, async (_uri, variables, extra) => {
    if (!deps.exports) throw new Error("EXPORT_REPOSITORY_REQUIRED");
    const exportId = variables.exportId;
    if (typeof exportId !== "string") throw new Error("EXPORT_ID_INVALID");
    const authenticatedOwner = extra.authInfo?.extra?.ownerId;
    const ownerId = typeof authenticatedOwner === "string" ? authenticatedOwner : deps.resourceOwnerId;
    if (ownerId === undefined) throw new Error("EXPORT_OWNER_REQUIRED");
    return { contents: [loadExportResource({ exports: deps.exports, exportId, ownerId })] };
  });
  return server;
}
