import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import type { McpTableBridge, ToolCallResult } from "../bridge/mcp-app";
import type { TableViewModel } from "../contracts";
import { explorationFixture } from "../fixtures/table-view";

type Call = { readonly name: string; readonly args: Record<string, unknown> };

function lifecycleBridge() {
  const calls: Call[] = [];
  let current: TableViewModel = {
    playerViewId: explorationFixture.playerViewId,
    audience: explorationFixture.audience,
    playerView: explorationFixture.playerView,
    visibleChecks: explorationFixture.visibleChecks,
    lastMutationId: explorationFixture.lastMutationId,
    serverStatus: explorationFixture.serverStatus,
  };
  const bridge: McpTableBridge = {
    async connect() { return () => undefined; },
    async callTool(name, args): Promise<ToolCallResult> {
      calls.push({ name, args });
      if (name === "create_checkpoint") {
        return { structuredContent: { checkpoint: {
          id: "test_checkpoint_widget",
          label: args.label,
          reason: "NAMED",
          stateVersion: 12,
          createdAt: "2026-08-27T12:15:00.000Z",
        } } };
      }
      if (name === "rewind_to_checkpoint") {
        current = {
          playerViewId: "b".repeat(64),
          audience: explorationFixture.audience,
          playerView: {
            ...explorationFixture.playerView,
            stateVersion: 13,
            currentDecision: { ...explorationFixture.playerView.currentDecision, stateVersion: 13 },
          },
          visibleChecks: explorationFixture.visibleChecks,
          lastMutationId: "test_turn_widget_rewind",
          serverStatus: explorationFixture.serverStatus,
        };
        return { structuredContent: {
          checkpoint: {
            id: "test_checkpoint_widget",
            label: "Before opening the vault",
            reason: "NAMED",
            stateVersion: 12,
            createdAt: "2026-08-27T12:15:00.000Z",
          },
          abandonedBranchId: "test_branch_old",
          activeBranchId: "test_branch_new",
          stateVersion: 13,
          currentDecision: current.playerView.currentDecision,
          playerViewId: current.playerViewId,
        } };
      }
      if (name === "get_table_view") {
        return { structuredContent: { playerViewId: current.playerViewId, view: current.playerView } };
      }
      if (name === "render_table") return { structuredContent: current };
      if (name === "export_campaign") return { structuredContent: {
        exportId: "test_export_widget",
        uri: "third-chair://exports/test_export_widget",
        mimeType: "application/zip",
        sizeBytes: 100,
        sha256: "c".repeat(64),
        expiresAt: "2026-08-28T12:15:00.000Z",
      } };
      throw new Error(`UNEXPECTED_TOOL:${name}`);
    },
  };
  return { bridge, calls };
}

describe("checkpoint and campaign lifecycle controls", () => {
  it("creates a mounted-session checkpoint and confirms its destructive rewind before calling", async () => {
    const { bridge, calls } = lifecycleBridge();
    render(<App view={explorationFixture} bridge={bridge} />);

    fireEvent.change(screen.getByLabelText("Checkpoint label"), { target: { value: "Before opening the vault" } });
    fireEvent.click(screen.getByRole("button", { name: "Create checkpoint" }));

    await waitFor(() => expect(calls.some(({ name }) => name === "create_checkpoint")).toBe(true));
    const createCall = calls.find(({ name }) => name === "create_checkpoint")!;
    expect(createCall.args).toMatchObject({
      campaignId: "test_campaign_lantern",
      expectedStateVersion: 12,
      label: "Before opening the vault",
    });
    expect(createCall.args.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(calls.map(({ name }) => name)).toEqual(["create_checkpoint", "get_table_view"]);

    fireEvent.click(await screen.findByRole("button", { name: "Rewind to Before opening the vault" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm campaign rewind" });
    expect(within(dialog).getByText("Before opening the vault")).toBeInTheDocument();
    expect(within(dialog).getByText("State 12")).toBeInTheDocument();
    expect(within(dialog).getByText(/abandoned branch/i)).toBeInTheDocument();
    expect(calls.some(({ name }) => name === "rewind_to_checkpoint")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm rewind" }));
    await waitFor(() => expect(screen.getByText("State 13")).toBeInTheDocument());
    const rewindCall = calls.find(({ name }) => name === "rewind_to_checkpoint")!;
    expect(rewindCall.args).toMatchObject({
      campaignId: "test_campaign_lantern",
      checkpointId: "test_checkpoint_widget",
      expectedStateVersion: 12,
      confirmed: true,
    });
    expect(rewindCall.args.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(calls.map(({ name }) => name)).toEqual([
      "create_checkpoint", "get_table_view", "rewind_to_checkpoint", "get_table_view", "render_table",
    ]);
  });

  it("defaults export to player-safe and warns separately before full-private export", async () => {
    const { bridge, calls } = lifecycleBridge();
    render(<App view={explorationFixture} bridge={bridge} />);

    fireEvent.click(screen.getByRole("button", { name: "Export player-safe SaveSet" }));
    await waitFor(() => expect(calls.some(({ name }) => name === "export_campaign")).toBe(true));
    expect(calls.find(({ name }) => name === "export_campaign")!.args).toMatchObject({
      campaignId: "test_campaign_lantern",
      expectedStateVersion: 12,
      mode: "PLAYER_SAFE",
      confirmedSpoilers: false,
    });
    expect(calls.map(({ name }) => name)).toEqual(["export_campaign", "get_table_view"]);

    fireEvent.click(screen.getByRole("button", { name: "Export full-private SaveSet" }));
    const warning = screen.getByRole("dialog", { name: "Confirm spoiler-bearing export" });
    expect(within(warning).getByText(/hidden campaign truth/i)).toBeInTheDocument();
    expect(calls.filter(({ name }) => name === "export_campaign")).toHaveLength(1);

    fireEvent.click(within(warning).getByRole("button", { name: "Export with spoilers" }));
    await waitFor(() => expect(calls.filter(({ name }) => name === "export_campaign")).toHaveLength(2));
    expect(calls.filter(({ name }) => name === "export_campaign")[1]!.args).toMatchObject({
      campaignId: "test_campaign_lantern",
      expectedStateVersion: 12,
      mode: "FULL_PRIVATE",
      confirmedSpoilers: true,
    });
    expect(calls.map(({ name }) => name)).toEqual([
      "export_campaign", "get_table_view", "export_campaign", "get_table_view",
    ]);
  });
});
