import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SCHEMA_VERSION } from "@third-chair/contracts";
import type { McpServer } from "../mcp/server.js";
export function createHttpApp(server: McpServer, fakeMode: boolean, sdkServer?: import("@modelcontextprotocol/sdk/server/mcp.js").McpServer) {
  const app = express(); app.use(express.json());
  app.get("/health", (_request, response) => response.json({ status: "ok", schemaVersion: SCHEMA_VERSION, databaseReady: true, fakeModelMode: fakeMode }));
  // A deliberately narrow HTTP dispatch keeps the player-facing boundary identical to MCP tools.
  if (sdkServer) {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    void sdkServer.connect(transport);
    app.all("/mcp", async (request, response, next) => { try { await transport.handleRequest(request, response, request.body); } catch (error) { next(error); } });
  } else {
    app.post("/mcp", async (request, response, next) => { try { response.json(await server.invoke(String(request.body?.name), request.body?.arguments)); } catch (error) { next(error); } });
  }
  return app;
}
