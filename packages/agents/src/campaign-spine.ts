import { Agent, type Tool } from "@openai/agents";
import {
  CampaignSpineInputSchema,
  CampaignSpineProposalSchema,
  type CampaignSpineInput,
  type CampaignSpineProposal,
  type SourcePackService,
} from "@third-chair/contracts";
import type { CampaignSpinePort } from "@third-chair/engine";
import type { AgentConfig } from "./config.js";
import { loadCampaignSpinePrompt } from "./prompt-loader.js";
import { AgentsSdkRunClient, type AgentRunClient } from "./runner.js";
import { createRetrievalTools, type DirectorRunContext } from "./tools/index.js";

export interface CampaignSpineAdapterOptions {
  readonly config: AgentConfig;
  readonly sourcePack: SourcePackService;
  readonly runClient?: AgentRunClient;
  readonly tools?: readonly Tool<DirectorRunContext>[];
}

export function createCampaignSpineAgent(config: AgentConfig, tools: readonly Tool<DirectorRunContext>[]) {
  return new Agent<DirectorRunContext, typeof CampaignSpineProposalSchema>({
    name: "Third Chair Campaign Spine",
    instructions: loadCampaignSpinePrompt(),
    model: config.directorModel,
    modelSettings: { reasoning: { effort: config.directorReasoning }, text: { verbosity: "low" }, parallelToolCalls: false },
    tools: [...tools],
    outputType: CampaignSpineProposalSchema,
  });
}

export class OpenAiCampaignSpineAdapter implements CampaignSpinePort {
  readonly #options: CampaignSpineAdapterOptions;
  readonly #client: AgentRunClient;
  readonly #tools: readonly Tool<DirectorRunContext>[];

  constructor(options: CampaignSpineAdapterOptions) {
    this.#options = options;
    this.#client = options.runClient ?? new AgentsSdkRunClient(options.config.traceMode);
    this.#tools = [...(options.tools ?? createRetrievalTools())];
  }

  async generate(rawInput: CampaignSpineInput): Promise<CampaignSpineProposal> {
    const input = CampaignSpineInputSchema.parse(rawInput);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#options.config.directorTimeoutMs);
    const context: DirectorRunContext = {
      turnId: input.requestId,
      campaignId: input.requestId,
      sourcePack: this.#options.sourcePack,
      intentsLocked: true,
      lockedIntents: [],
      abortSignal: controller.signal,
      lockAndResolveChecks: () => { throw new Error("CAMPAIGN_SPINE_HAS_NO_RESOLUTION_AUTHORITY"); },
    };
    try {
      const result = await this.#client.run(createCampaignSpineAgent(this.#options.config, this.#tools), JSON.stringify(input), {
        context,
        maxTurns: 8,
        signal: controller.signal,
        toolExecution: { maxFunctionToolConcurrency: 1 },
      });
      if (controller.signal.aborted) throw new Error("CAMPAIGN_SPINE_TIMEOUT");
      return CampaignSpineProposalSchema.parse(result.finalOutput);
    } finally {
      clearTimeout(timeout);
    }
  }
}
