import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

export const TABLE_WIDGET_URI = "ui://third-chair/table-v1.html";
export const DEFAULT_WIDGET_BUILD_PATH = resolve(process.cwd(), "apps/widget/dist/index.html");

export interface WidgetResource {
  readonly uri: typeof TABLE_WIDGET_URI;
  readonly mimeType: typeof RESOURCE_MIME_TYPE;
  readonly text: string;
  readonly _meta: {
    readonly "openai/widgetDescription": string;
    readonly ui: {
      readonly csp: { readonly connectDomains: readonly []; readonly resourceDomains: readonly [] };
      readonly prefersBorder: false;
    };
  };
}

export function loadWidgetResource(path = DEFAULT_WIDGET_BUILD_PATH): WidgetResource {
  if (!existsSync(path)) throw new Error(`WIDGET_BUILD_MISSING: ${path}`);
  const text = readFileSync(path, "utf8");
  if (text.trim().length === 0) throw new Error(`WIDGET_BUILD_MISSING: ${path}`);
  return {
    uri: TABLE_WIDGET_URI,
    mimeType: RESOURCE_MIME_TYPE,
    text,
    _meta: {
      "openai/widgetDescription": "A persistent, player-safe Third Chair table showing the current scene, character status, visible dice, combat, clues, and recovery state.",
      ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: false },
    },
  };
}
