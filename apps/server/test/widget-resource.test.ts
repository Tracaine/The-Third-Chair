import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWidgetResource, TABLE_WIDGET_URI } from "@third-chair/server";

describe("versioned widget resource", () => {
  it("loads one self-contained MCP App document with exact CSP metadata", () => {
    const directory = mkdtempSync(join(tmpdir(), "third-chair-widget-resource-"));
    const path = join(directory, "index.html");
    writeFileSync(path, "<!doctype html><html><body>Raven's Table</body></html>");
    const resource = loadWidgetResource(path);
    expect(resource).toEqual({
      uri: TABLE_WIDGET_URI,
      mimeType: "text/html;profile=mcp-app",
      text: "<!doctype html><html><body>Raven's Table</body></html>",
      _meta: {
        "openai/widgetDescription": "A persistent, player-safe Third Chair table showing the current scene, character status, visible dice, combat, clues, and recovery state.",
        ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: false },
      },
    });
  });

  it("fails readiness instead of serving a blank or missing build", () => {
    expect(() => loadWidgetResource("/definitely/missing/third-chair-widget.html")).toThrow("WIDGET_BUILD_MISSING");
  });
});
