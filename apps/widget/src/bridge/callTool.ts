import { GetTableViewOutputSchema, TableViewPayloadSchema, type TableViewPayload } from "@third-chair/contracts";
import type { TableViewModel } from "../contracts";
import type { McpTableBridge, ToolCallResult } from "./mcp-app";

export type { McpTableBridge } from "./mcp-app";
export type ToolCaller = (name: string, args: Record<string, unknown>) => Promise<ToolCallResult>;

export async function refreshTable(current: TableViewModel, callTool: ToolCaller): Promise<TableViewPayload | undefined> {
  const getResult = await callTool("get_table_view", {
    campaignId: current.playerView.campaignId,
    audience: current.audience,
  });
  if (getResult.isError) throw new Error("TABLE_REFRESH_FAILED");
  const fresh = GetTableViewOutputSchema.parse(getResult.structuredContent);
  if (fresh.playerViewId === current.playerViewId) return undefined;

  const renderResult = await callTool("render_table", {
    campaignId: current.playerView.campaignId,
    audience: current.audience,
    playerViewId: fresh.playerViewId,
  });
  if (renderResult.isError) throw new Error("TABLE_RENDER_FAILED");
  return TableViewPayloadSchema.parse(renderResult.structuredContent);
}
