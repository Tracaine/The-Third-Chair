import { getEntityTool } from "./get-entity.js";
import { lockAndResolveChecksTool } from "./lock-and-resolve-checks.js";
import { searchLoreTool } from "./search-lore.js";
import { searchRulesTool } from "./search-rules.js";
import { searchTimelineTool } from "./search-timeline.js";

export type { DirectorRunContext } from "./context.js";

/** Private local tools only; these are never registered on the public MCP server. */
export function createRetrievalTools() {
  return [searchRulesTool, searchLoreTool, searchTimelineTool, getEntityTool];
}

/** Complete private Director tool set. Repository and RNG authority remain in the engine callback. */
export function createDirectorTools() {
  return [...createRetrievalTools(), lockAndResolveChecksTool];
}
