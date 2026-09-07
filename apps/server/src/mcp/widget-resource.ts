import { existsSync, readFileSync } from "node:fs";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { DEFAULT_WIDGET_BUILD_PATH } from "../project-paths.js";

export const TABLE_WIDGET_URI = "ui://third-chair/table-v1.html";
export const DEFAULT_WIDGET_DOMAIN = "https://tracaine.github.io";
export { DEFAULT_WIDGET_BUILD_PATH };

export interface WidgetResource {
  readonly uri: typeof TABLE_WIDGET_URI;
  readonly mimeType: typeof RESOURCE_MIME_TYPE;
  readonly text: string;
  readonly _meta: {
    readonly "openai/widgetDescription": string;
    readonly "openai/widgetDomain": string;
    readonly ui: {
      readonly csp: { readonly connectDomains: readonly []; readonly resourceDomains: readonly [] };
      readonly domain: string;
      readonly prefersBorder: false;
    };
  };
}

function widgetDomain(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value.replace(/\/$/, "") || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("INVALID_WIDGET_DOMAIN");
  }
  return url.origin;
}

export function loadWidgetResource(
  path = DEFAULT_WIDGET_BUILD_PATH,
  domain = process.env.THIRD_CHAIR_WIDGET_DOMAIN ?? DEFAULT_WIDGET_DOMAIN,
): WidgetResource {
  if (!existsSync(path)) throw new Error(`WIDGET_BUILD_MISSING: ${path}`);
  const text = readFileSync(path, "utf8");
  if (text.trim().length === 0) throw new Error(`WIDGET_BUILD_MISSING: ${path}`);
  const origin = widgetDomain(domain);
  return {
    uri: TABLE_WIDGET_URI,
    mimeType: RESOURCE_MIME_TYPE,
    text,
    _meta: {
      "openai/widgetDescription": "A persistent, player-safe Third Chair table showing the current scene, character status, visible dice, combat, clues, and recovery state.",
      "openai/widgetDomain": origin,
      ui: { csp: { connectDomains: [], resourceDomains: [] }, domain: origin, prefersBorder: false },
    },
  };
}
