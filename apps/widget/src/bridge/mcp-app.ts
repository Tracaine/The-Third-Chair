import { App as McpApp } from "@modelcontextprotocol/ext-apps";

export interface ToolCallResult {
  readonly content?: readonly unknown[];
  readonly structuredContent?: Record<string, unknown>;
  readonly isError?: boolean;
}

export interface DownloadableResourceLink {
  readonly type: "resource_link";
  readonly name: string;
  readonly uri: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly size?: number;
}

type ToolResultListener = (params: { structuredContent?: Record<string, unknown> }) => void;

export interface AppClient {
  addEventListener(name: "toolresult", callback: ToolResultListener): void;
  removeEventListener(name: "toolresult", callback: ToolResultListener): void;
  connect(): Promise<unknown>;
  callServerTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<ToolCallResult>;
  downloadFile(params: { contents: DownloadableResourceLink[] }): Promise<ToolCallResult>;
}

export interface McpTableBridge {
  connect(onResult: (value: unknown) => void): Promise<() => void>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
  downloadFile(resource: DownloadableResourceLink): Promise<ToolCallResult>;
}

export function createMcpTableBridge(client: AppClient): McpTableBridge {
  return {
    async connect(onResult) {
      const listener: ToolResultListener = (params) => onResult(params.structuredContent);
      client.addEventListener("toolresult", listener);
      try {
        await client.connect();
      } catch (error) {
        client.removeEventListener("toolresult", listener);
        throw error;
      }
      return () => client.removeEventListener("toolresult", listener);
    },
    callTool(name, args) {
      return client.callServerTool({ name, arguments: args });
    },
    downloadFile(resource) {
      return client.downloadFile({ contents: [resource] });
    },
  };
}

export function createDefaultBridge(): McpTableBridge | undefined {
  if (window.parent === window) return undefined;
  const client = new McpApp({ name: "Raven's Table", version: "0.1.0" }, {});
  return createMcpTableBridge(client as unknown as AppClient);
}
