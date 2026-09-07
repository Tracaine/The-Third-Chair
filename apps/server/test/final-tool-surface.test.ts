import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer, createSdkMcpServer } from "@third-chair/server";

const expectedAnnotations = {
  list_campaigns: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  create_campaign: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  get_table_view: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  advance_game: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  answer_rules: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  recall_known_lore: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  create_checkpoint: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  rewind_to_checkpoint: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true },
  render_table: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  export_campaign: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
} as const;

const expectedNames = Object.keys(expectedAnnotations);

describe("final MCP tool surface", () => {
  it("advertises exactly the ten binding tools with complete annotations and schemas", () => {
    const mcp = createMcpServer({ campaigns: {} as never, turns: {} as never, engine: {} as never });

    expect(mcp.tools.map(({ name }) => name)).toEqual(expectedNames);
    expect(Object.fromEntries(mcp.tools.map(({ name, annotations }) => [name, annotations]))).toEqual(expectedAnnotations);
    for (const descriptor of mcp.tools) {
      expect(descriptor.inputSchema).toBeDefined();
      expect(descriptor.outputSchema).toBeDefined();
    }
  });

  it("publishes the same ten-tool surface and refreshed version through the SDK boundary", async () => {
    const server = createSdkMcpServer(
      { campaigns: {} as never, turns: {} as never, engine: {} as never },
      {
        uri: "ui://third-chair/table-v1.html",
        mimeType: "text/html;profile=mcp-app",
        text: "<!doctype html><title>Test table</title>",
        _meta: {
          "openai/widgetDescription": "Test table",
          "openai/widgetDomain": "https://tracaine.github.io",
          ui: { csp: { connectDomains: [], resourceDomains: [] }, domain: "https://tracaine.github.io", prefersBorder: false },
        },
      },
    );
    const client = new Client({ name: "third-chair-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      expect(client.getServerVersion()).toEqual({ name: "third-chair", version: "0.2.1" });
      const listed = await client.listTools();
      expect(listed.tools.map(({ name }) => name)).toEqual(expectedNames);
      expect(Object.fromEntries(listed.tools.map(({ name, annotations }) => [name, annotations]))).toEqual(expectedAnnotations);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
