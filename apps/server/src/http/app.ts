import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { SCHEMA_VERSION } from "@third-chair/contracts";
import type { McpServer } from "../mcp/server.js";

export type SdkMcpServerFactory = () => SdkMcpServer;

export function createHttpApp(
  server: McpServer,
  fakeMode: boolean,
  sdkServerFactory?: SdkMcpServerFactory,
) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_request, response) =>
    response.json({
      status: "ok",
      schemaVersion: SCHEMA_VERSION,
      databaseReady: true,
      fakeModelMode: fakeMode,
    }),
  );

  if (sdkServerFactory) {
    app.post("/mcp", async (request, response, next) => {
      const sdkServer = sdkServerFactory();

      // Empty options select stateless mode without explicitly passing
      // undefined through exactOptionalPropertyTypes.
      const transport = new StreamableHTTPServerTransport({});

      response.on("close", () => {
        void transport.close();
        void sdkServer.close();
      });

      try {
        // SDK v1's concrete Node transport and Transport interface have
        // incompatible exact-optional callback declarations. Keep the
        // workaround isolated to this SDK boundary.
        await sdkServer.connect(transport as Transport);

        await transport.handleRequest(
          request,
          response,
          request.body,
        );
      } catch (error) {
        next(error);
      }
    });
  } else {
    app.post("/mcp", async (request, response, next) => {
      try {
        response.json(
          await server.invoke(
            String(request.body?.name),
            request.body?.arguments,
          ),
        );
      } catch (error) {
        next(error);
      }
    });
  }

  return app;
}