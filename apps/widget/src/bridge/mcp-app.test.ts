import { describe, expect, it, vi } from "vitest";
import { createMcpTableBridge, type AppClient } from "./mcp-app";

describe("MCP Apps bridge", () => {
  it("subscribes to tool results before connecting and calls server tools through the standard bridge", async () => {
    const order: string[] = [];
    let listener: ((params: { structuredContent?: Record<string, unknown> }) => void) | undefined;
    const client: AppClient = {
      addEventListener: vi.fn((name, callback) => { order.push("listen:" + name); listener = callback; }),
      removeEventListener: vi.fn(),
      connect: vi.fn(async () => { order.push("connect"); }),
      callServerTool: vi.fn(async () => ({ content: [], structuredContent: { ok: true } })),
    };
    const bridge = createMcpTableBridge(client);
    const onResult = vi.fn();
    const disconnect = await bridge.connect(onResult);

    expect(order).toEqual(["listen:toolresult", "connect"]);
    listener?.({ structuredContent: { serverStatus: "READY" } });
    expect(onResult).toHaveBeenCalledWith({ serverStatus: "READY" });
    await expect(bridge.callTool("get_table_view", { campaignId: "test_campaign" })).resolves.toMatchObject({ structuredContent: { ok: true } });
    disconnect();
    expect(client.removeEventListener).toHaveBeenCalledWith("toolresult", expect.any(Function));
  });
});
