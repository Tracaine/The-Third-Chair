import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWidgetPreferences } from "./useWidgetPreferences";

describe("presentation-only widget state", () => {
  it("persists only expanded panels, selected tab, and reduced-motion preference", () => {
    const setWidgetState = vi.fn();
    window.openai = {
      widgetState: { expandedPanelIds: ["dice"], selectedTab: "story", reducedMotion: false, campaignId: "must_not_survive" },
      setWidgetState,
    };
    const { result } = renderHook(() => useWidgetPreferences());
    expect(result.current.preferences).toEqual({ expandedPanelIds: ["dice"], selectedTab: "story", reducedMotion: false });
    act(() => result.current.update({ selectedTab: "party" }));
    expect(setWidgetState).toHaveBeenLastCalledWith({ expandedPanelIds: ["dice"], selectedTab: "party", reducedMotion: false });
  });
});
