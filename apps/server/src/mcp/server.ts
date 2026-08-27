import type { CampaignRepository } from "@third-chair/storage";
import type { TurnEngine } from "@third-chair/engine";
import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { advanceGame, advanceGameDescriptor } from "./tools/advance-game.js";
import { getTableView, getTableViewDescriptor } from "./tools/get-table-view.js";
export interface McpServer { readonly tools: readonly { readonly name: string; readonly description: string; readonly inputSchema: unknown; readonly outputSchema: unknown; readonly annotations: object }[]; invoke(name: string, input: unknown): Promise<unknown>; }
export function createMcpServer(deps: { campaigns: CampaignRepository; engine: TurnEngine }): McpServer {
  return { tools: [getTableViewDescriptor, advanceGameDescriptor], async invoke(name, input) { if (name === "get_table_view") return getTableView(deps, input as { campaignId: string }); if (name === "advance_game") return advanceGame(deps, input); throw new Error("UNKNOWN_TOOL"); } };
}

/** SDK registration is kept beside the in-process adapter so the same handlers own both boundaries. */
export function createSdkMcpServer(deps: { campaigns: CampaignRepository; engine: TurnEngine }): SdkMcpServer {
  const server = new SdkMcpServer({ name: "third-chair", version: "0.1.0" });
  server.registerTool(getTableViewDescriptor.name, { description: getTableViewDescriptor.description, inputSchema: getTableViewDescriptor.inputSchema, outputSchema: getTableViewDescriptor.outputSchema, annotations: getTableViewDescriptor.annotations }, async (input) => getTableView(deps, input));
  server.registerTool(advanceGameDescriptor.name, { description: advanceGameDescriptor.description, inputSchema: advanceGameDescriptor.inputSchema, annotations: advanceGameDescriptor.annotations }, async (input) => advanceGame(deps, input));
  return server;
}
