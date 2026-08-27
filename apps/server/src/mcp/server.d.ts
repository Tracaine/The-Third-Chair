import type { CampaignRepository } from "@third-chair/storage";
import type { TurnEngine } from "@third-chair/engine";
import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export interface McpServer {
    readonly tools: readonly {
        readonly name: string;
        readonly description: string;
        readonly inputSchema: unknown;
        readonly outputSchema: unknown;
        readonly annotations: object;
    }[];
    invoke(name: string, input: unknown): Promise<unknown>;
}
export declare function createMcpServer(deps: {
    campaigns: CampaignRepository;
    engine: TurnEngine;
}): McpServer;
/** SDK registration is kept beside the in-process adapter so the same handlers own both boundaries. */
export declare function createSdkMcpServer(deps: {
    campaigns: CampaignRepository;
    engine: TurnEngine;
}): SdkMcpServer;
//# sourceMappingURL=server.d.ts.map