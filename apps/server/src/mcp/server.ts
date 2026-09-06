import type { CampaignRepository, TurnRepository } from "@third-chair/storage";
import type { TurnEngine } from "@third-chair/engine";
import type { SourcePackService } from "@third-chair/contracts";
import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { advanceGame, advanceGameDescriptor } from "./tools/advance-game.js";
import { getTableView, getTableViewDescriptor } from "./tools/get-table-view.js";
import { listCampaigns, listCampaignsDescriptor } from "./tools/list-campaigns.js";
import { answerRules, answerRulesDescriptor } from "./tools/answer-rules.js";
import { recallKnownLore, recallKnownLoreDescriptor } from "./tools/recall-known-lore.js";
import { renderTable, renderTableDescriptor } from "./tools/render-table.js";
import { loadWidgetResource, TABLE_WIDGET_URI, type WidgetResource } from "./widget-resource.js";
export interface McpServer { readonly tools: readonly { readonly name: string; readonly description: string; readonly inputSchema: unknown; readonly outputSchema: unknown; readonly annotations: object }[]; invoke(name: string, input: unknown): Promise<unknown>; }
type ServerDependencies = { campaigns: CampaignRepository; turns: TurnRepository; engine: TurnEngine; sourcePack?: SourcePackService };
function requireSourcePack(deps: ServerDependencies): SourcePackService { if (!deps.sourcePack) throw new Error("SOURCE_PACK_REQUIRED"); return deps.sourcePack; }
export function createMcpServer(deps: ServerDependencies): McpServer {
  return { tools: [listCampaignsDescriptor, getTableViewDescriptor, advanceGameDescriptor, answerRulesDescriptor, recallKnownLoreDescriptor, renderTableDescriptor], async invoke(name, input) {
    if (name === "list_campaigns") return listCampaigns(deps, input as never);
    if (name === "get_table_view") return getTableView(deps, input as never);
    if (name === "advance_game") return advanceGame(deps, input);
    if (name === "answer_rules") return answerRules({ ...deps, sourcePack: requireSourcePack(deps) }, input as never);
    if (name === "recall_known_lore") return recallKnownLore({ ...deps, sourcePack: requireSourcePack(deps) }, input as never);
    if (name === "render_table") return renderTable(deps, input as never);
    throw new Error("UNKNOWN_TOOL");
  } };
}

/** SDK registration is kept beside the in-process adapter so the same handlers own both boundaries. */
export function createSdkMcpServer(deps: ServerDependencies, widgetResource: WidgetResource = loadWidgetResource()): SdkMcpServer {
  const server = new SdkMcpServer({ name: "third-chair", version: "0.1.0" });
  server.registerTool(listCampaignsDescriptor.name, { description: listCampaignsDescriptor.description, inputSchema: listCampaignsDescriptor.inputSchema, outputSchema: listCampaignsDescriptor.outputSchema, annotations: listCampaignsDescriptor.annotations }, async (input) => listCampaigns(deps, input));
  server.registerTool(getTableViewDescriptor.name, { description: getTableViewDescriptor.description, inputSchema: getTableViewDescriptor.inputSchema, outputSchema: getTableViewDescriptor.outputSchema, annotations: getTableViewDescriptor.annotations }, async (input) => getTableView(deps, input));
  server.registerTool(advanceGameDescriptor.name, { description: advanceGameDescriptor.description, inputSchema: advanceGameDescriptor.inputSchema, outputSchema: advanceGameDescriptor.outputSchema, annotations: advanceGameDescriptor.annotations }, async (input) => advanceGame(deps, input));
  server.registerTool(answerRulesDescriptor.name, { description: answerRulesDescriptor.description, inputSchema: answerRulesDescriptor.inputSchema, outputSchema: answerRulesDescriptor.outputSchema, annotations: answerRulesDescriptor.annotations }, async (input) => answerRules({ ...deps, sourcePack: requireSourcePack(deps) }, input));
  server.registerTool(recallKnownLoreDescriptor.name, { description: recallKnownLoreDescriptor.description, inputSchema: recallKnownLoreDescriptor.inputSchema, outputSchema: recallKnownLoreDescriptor.outputSchema, annotations: recallKnownLoreDescriptor.annotations }, async (input) => recallKnownLore({ ...deps, sourcePack: requireSourcePack(deps) }, input));
  registerAppTool(server, renderTableDescriptor.name, {
    title: renderTableDescriptor.title,
    description: renderTableDescriptor.description,
    inputSchema: renderTableDescriptor.inputSchema,
    outputSchema: renderTableDescriptor.outputSchema,
    annotations: renderTableDescriptor.annotations,
    _meta: renderTableDescriptor._meta,
  }, async (input) => renderTable(deps, input));
  registerAppResource(server, "Raven's Table", TABLE_WIDGET_URI, {
    mimeType: widgetResource.mimeType,
    description: "Persistent player-safe Third Chair table",
  }, async () => ({ contents: [widgetResource] }));
  return server;
}
