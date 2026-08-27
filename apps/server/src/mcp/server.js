import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { advanceGame, advanceGameDescriptor } from "./tools/advance-game.js";
import { getTableView, getTableViewDescriptor } from "./tools/get-table-view.js";
export function createMcpServer(deps) {
    return { tools: [getTableViewDescriptor, advanceGameDescriptor], async invoke(name, input) { if (name === "get_table_view")
            return getTableView(deps, input); if (name === "advance_game")
            return advanceGame(deps, input); throw new Error("UNKNOWN_TOOL"); } };
}
/** SDK registration is kept beside the in-process adapter so the same handlers own both boundaries. */
export function createSdkMcpServer(deps) {
    const server = new SdkMcpServer({ name: "third-chair", version: "0.1.0" });
    server.registerTool(getTableViewDescriptor.name, { description: getTableViewDescriptor.description, inputSchema: getTableViewDescriptor.inputSchema, outputSchema: getTableViewDescriptor.outputSchema, annotations: getTableViewDescriptor.annotations }, async (input) => getTableView(deps, input));
    server.registerTool(advanceGameDescriptor.name, { description: advanceGameDescriptor.description, inputSchema: advanceGameDescriptor.inputSchema, annotations: advanceGameDescriptor.annotations }, async (input) => advanceGame(deps, input));
    return server;
}
//# sourceMappingURL=server.js.map