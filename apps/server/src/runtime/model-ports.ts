import { OpenAiDirectorAdapter, OpenAiNarratorAdapter, type AgentConfig } from "@third-chair/agents";
import type { SourcePackService } from "@third-chair/contracts";

export function createLiveModelPorts(config: AgentConfig, sourcePack: SourcePackService) {
  return {
    director: new OpenAiDirectorAdapter({ config, sourcePack }),
    narrator: new OpenAiNarratorAdapter({ config }),
  };
}
