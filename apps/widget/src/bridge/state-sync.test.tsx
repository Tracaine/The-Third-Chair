import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { explorationFixture } from "../fixtures/table-view";
import { refreshTable, type McpTableBridge } from "./callTool";

function fakeBridge() {
  let listener: ((value: unknown) => void) | undefined;
  const bridge: McpTableBridge = {
    connect: vi.fn(async (next) => { listener = next; return () => { listener = undefined; }; }),
    callTool: vi.fn(async () => ({ content: [] })),
  };
  return { bridge, emit: (value: unknown) => listener?.(value) };
}

function fixturePayload() {
  const { actorNames: _actorNames, hiddenFixtureFields: _hiddenFixtureFields, ...payload } = explorationFixture;
  return payload;
}

describe("mounted table state sync", () => {
  it("updates for a newer result and ignores a duplicate mutation receipt", async () => {
    const host = fakeBridge();
    render(<App view={explorationFixture} bridge={host.bridge} />);
    await act(async () => {});
    expect(screen.getByText("State 12")).toBeInTheDocument();

    const newer = {
      ...fixturePayload(),
      playerViewId: "b".repeat(64),
      lastMutationId: "test_turn_13",
      playerView: { ...explorationFixture.playerView, stateVersion: 13 },
    };
    act(() => host.emit(newer));
    expect(screen.getByText("State 13")).toBeInTheDocument();
    const token = screen.getByTestId("table-shell").getAttribute("data-update-token");

    act(() => host.emit({ ...newer, playerView: { ...newer.playerView, stateVersion: 99 } }));
    expect(screen.queryByText("State 99")).not.toBeInTheDocument();
    expect(screen.getByTestId("table-shell").getAttribute("data-update-token")).toBe(token);
  });

  it("refreshes only when get_table_view returns a different playerViewId", async () => {
    const same = vi.fn(async () => ({ structuredContent: { playerViewId: explorationFixture.playerViewId, view: explorationFixture.playerView } }));
    await refreshTable(explorationFixture, same);
    expect(same).toHaveBeenCalledTimes(1);

    const changed = vi.fn()
      .mockResolvedValueOnce({ structuredContent: { playerViewId: "c".repeat(64), view: { ...explorationFixture.playerView, stateVersion: 13 } } })
      .mockResolvedValueOnce({ structuredContent: { ...fixturePayload(), playerViewId: "c".repeat(64) } });
    await refreshTable(explorationFixture, changed);
    expect(changed).toHaveBeenNthCalledWith(2, "render_table", expect.objectContaining({ playerViewId: "c".repeat(64) }));
  });

  it("exposes refresh as the only game-facing widget action", async () => {
    const host = fakeBridge();
    render(<App view={explorationFixture} bridge={host.bridge} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Refresh table" }));
    expect(host.bridge.callTool).toHaveBeenCalledWith("get_table_view", expect.objectContaining({ campaignId: "test_campaign_lantern" }));
    expect(screen.queryByRole("button", { name: /act|attack|speak for/i })).not.toBeInTheDocument();
  });
});
