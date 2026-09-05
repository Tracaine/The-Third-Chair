import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { combatFixture, explorationFixture } from "./fixtures/table-view";
import type { WidgetPreferences } from "./contracts";

const params = new URLSearchParams(window.location.search);
const fixture = params.get("fixture") === "combat" ? combatFixture : explorationFixture;
const requestedTheme = params.get("theme");
const initialTheme: WidgetPreferences["theme"] = requestedTheme === "light" || requestedTheme === "dark"
  ? requestedTheme
  : "system";
const root = document.getElementById("root");

if (!root) throw new Error("Widget root element is missing");

createRoot(root).render(
  <StrictMode>
    <App view={fixture} initialTheme={initialTheme} />
  </StrictMode>,
);
