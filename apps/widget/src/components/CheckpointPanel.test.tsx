import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import type { DownloadableResourceLink, McpTableBridge, ToolCallResult } from "../bridge/mcp-app";
import type { TableViewModel } from "../contracts";
import { explorationFixture } from "../fixtures/table-view";

type Call = { readonly name: string; readonly args: Record<string, unknown> };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function lifecycleBridge(options: {
  readonly firstTableView?: Promise<ToolCallResult>;
  readonly secondTableView?: Promise<ToolCallResult>;
} = {}) {
  const calls: Call[] = [];
  const downloads: DownloadableResourceLink[] = [];
  let tableViewCalls = 0;
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
    async downloadFile(resource) {
      downloads.push(resource);
      return {};
    },
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
        tableViewCalls += 1;
        if (tableViewCalls === 1 && options.firstTableView) return options.firstTableView;
        if (tableViewCalls === 2 && options.secondTableView) return options.secondTableView;
        return { structuredContent: { playerViewId: current.playerViewId, view: current.playerView } };
      }
      if (name === "render_table") return { structuredContent: current };
      if (name === "export_campaign") return {
        content: [
          { type: "text", text: `${String(args.mode)} SaveSet exported (100 bytes).` },
          {
            type: "resource_link",
            name: "third-chair-test_export_widget.zip",
            uri: "third-chair://exports/test_export_widget",
            description: `Expiring ${String(args.mode)} campaign SaveSet`,
            mimeType: "application/zip",
            size: 100,
          },
        ],
        structuredContent: {
          exportId: "test_export_widget",
          uri: "third-chair://exports/test_export_widget",
          mimeType: "application/zip",
          sizeBytes: 100,
          sha256: "c".repeat(64),
          expiresAt: "2026-08-28T12:15:00.000Z",
        },
      };
      throw new Error(`UNEXPECTED_TOOL:${name}`);
    },
  };
  return { bridge, calls, downloads };
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

    const rewindTrigger = await screen.findByRole("button", { name: "Rewind to Before opening the vault" });
    fireEvent.click(rewindTrigger);
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
    await waitFor(() => expect(rewindTrigger).toHaveFocus());
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

  it("contains modal focus, closes on Escape, and restores focus to the rewind trigger", async () => {
    const { bridge } = lifecycleBridge();
    render(<App view={explorationFixture} bridge={bridge} />);
    fireEvent.change(screen.getByLabelText("Checkpoint label"), { target: { value: "Before opening the vault" } });
    fireEvent.click(screen.getByRole("button", { name: "Create checkpoint" }));

    const trigger = await screen.findByRole("button", { name: "Rewind to Before opening the vault" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Confirm campaign rewind" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm rewind" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });

    await waitFor(() => expect(confirm).toHaveFocus());
    expect(screen.getByTestId("table-shell")).toHaveAttribute("inert");
    cancel.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Confirm campaign rewind" })).not.toBeInTheDocument());
    expect(screen.getByTestId("table-shell")).not.toHaveAttribute("inert");
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    const reopened = screen.getByRole("dialog", { name: "Confirm campaign rewind" });
    fireEvent.click(within(reopened).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Confirm campaign rewind" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("queues a post-rewind refresh when a manual refresh is already in flight", async () => {
    const firstRefresh = deferred<ToolCallResult>();
    const { bridge, calls } = lifecycleBridge({ secondTableView: firstRefresh.promise });
    render(<App view={explorationFixture} bridge={bridge} />);
    fireEvent.change(screen.getByLabelText("Checkpoint label"), { target: { value: "Before opening the vault" } });
    fireEvent.click(screen.getByRole("button", { name: "Create checkpoint" }));
    const rewindTrigger = await screen.findByRole("button", { name: "Rewind to Before opening the vault" });

    fireEvent.click(screen.getByRole("button", { name: "Refresh table" }));
    await waitFor(() => expect(calls.filter(({ name }) => name === "get_table_view")).toHaveLength(2));
    fireEvent.click(rewindTrigger);
    fireEvent.click(screen.getByRole("button", { name: "Confirm rewind" }));
    await waitFor(() => expect(calls.some(({ name }) => name === "rewind_to_checkpoint")).toBe(true));

    firstRefresh.resolve({ structuredContent: {
      playerViewId: explorationFixture.playerViewId,
      view: explorationFixture.playerView,
    } });
    await waitFor(() => expect(calls.filter(({ name }) => name === "get_table_view")).toHaveLength(3));
    await waitFor(() => expect(screen.getByText("State 13")).toBeInTheDocument());
  });

  it("keeps an in-flight confirmation modal until refresh settles, then restores its enabled trigger", async () => {
    const exportRefresh = deferred<ToolCallResult>();
    const { bridge, calls } = lifecycleBridge({ firstTableView: exportRefresh.promise });
    render(<App view={explorationFixture} bridge={bridge} />);

    const trigger = screen.getByRole("button", { name: "Export full-private SaveSet" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Confirm spoiler-bearing export" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Export with spoilers" }));
    await waitFor(() => expect(calls.some(({ name }) => name === "get_table_view")).toBe(true));

    expect(screen.getByRole("dialog", { name: "Confirm spoiler-bearing export" })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Confirm spoiler-bearing export" })).toBeInTheDocument();

    exportRefresh.resolve({ structuredContent: {
      playerViewId: explorationFixture.playerViewId,
      view: explorationFixture.playerView,
    } });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Confirm spoiler-bearing export" })).not.toBeInTheDocument());
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveFocus();
  });

  it("renders the returned export resource as an accessible archive action", async () => {
    const { bridge, downloads } = lifecycleBridge();
    render(<App view={explorationFixture} bridge={bridge} />);

    fireEvent.click(screen.getByRole("button", { name: "Export player-safe SaveSet" }));

    const archive = await screen.findByRole("button", { name: "Download player-safe SaveSet" });
    expect(screen.getByText("100 bytes · expires 28 Aug 2026, 12:15 UTC")).toBeInTheDocument();
    fireEvent.click(archive);
    await waitFor(() => expect(downloads).toEqual([{
      type: "resource_link",
      name: "third-chair-test_export_widget.zip",
      uri: "third-chair://exports/test_export_widget",
      description: "Expiring PLAYER_SAFE campaign SaveSet",
      mimeType: "application/zip",
      size: 100,
    }]));
  });
});
