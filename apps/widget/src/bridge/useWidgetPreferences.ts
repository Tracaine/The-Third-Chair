import { useState } from "react";
import type { WidgetPreferences } from "../contracts";

const defaults: WidgetPreferences = { expandedPanelIds: [], selectedTab: "story", reducedMotion: false };

function sanitize(value: unknown): WidgetPreferences {
  if (!value || typeof value !== "object") return defaults;
  const record = value as Record<string, unknown>;
  return {
    expandedPanelIds: Array.isArray(record.expandedPanelIds) ? record.expandedPanelIds.filter((id): id is string => typeof id === "string") : [],
    selectedTab: record.selectedTab === "party" ? "party" : "story",
    reducedMotion: record.reducedMotion === true,
  };
}

export function useWidgetPreferences() {
  const [preferences, setPreferences] = useState(() => sanitize(window.openai?.widgetState));
  const update = (patch: Partial<WidgetPreferences>) => {
    setPreferences((current) => {
      const next = sanitize({ ...current, ...patch });
      void window.openai?.setWidgetState?.({ ...next, expandedPanelIds: [...next.expandedPanelIds] });
      return next;
    });
  };
  return { preferences, update };
}
