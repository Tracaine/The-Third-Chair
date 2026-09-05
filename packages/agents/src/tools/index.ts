import { getEntityTool } from "./get-entity.js";
import { searchLoreTool } from "./search-lore.js";
import { searchRulesTool } from "./search-rules.js";
import { searchTimelineTool } from "./search-timeline.js";

export type { DirectorRunContext } from "./context.js";

/** Private local tools only; these are never registered on the public MCP server. */
export function createRetrievalTools() {
  return [searchRulesTool, searchLoreTool, searchTimelineTool, getEntityTool];
}
