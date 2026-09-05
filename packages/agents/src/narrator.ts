import { Agent } from "@openai/agents";
import { NarrationSchema, type Narration, type NarratorInput as EngineNarratorInput, type NarratorPort } from "@third-chair/engine";
import type { AgentConfig } from "./config.js";
import { buildNarratorInput } from "./context/narrator-context.js";
import { validateNarration } from "./narration-validator.js";
import { loadNarratorPrompt } from "./prompt-loader.js";
import { AgentsSdkRunClient, type AgentRunClient } from "./runner.js";
import { classifyProviderError } from "./provider-error.js";

export interface NarratorRunContext { readonly abortSignal: AbortSignal; }
export interface NarratorAdapterOptions { readonly config: AgentConfig; readonly runClient?: AgentRunClient; }

export function createNarratorAgent(config: AgentConfig) {
  return new Agent<NarratorRunContext, typeof NarrationSchema>({
    name: "Third Chair Narrator", instructions: loadNarratorPrompt(), model: config.narratorModel,
    modelSettings: { reasoning: { effort: config.narratorReasoning }, text: { verbosity: "low" } },
    tools: [], outputType: NarrationSchema,
  });
}

export class OpenAiNarratorAdapter implements NarratorPort {
  readonly #config: AgentConfig;
  readonly #client: AgentRunClient;
  constructor(options: NarratorAdapterOptions) {
    this.#config = options.config;
    this.#client = options.runClient ?? new AgentsSdkRunClient(options.config.traceMode);
  }

  async narrate(input: EngineNarratorInput): Promise<Narration> {
    const bounded = buildNarratorInput({
      beforeView: input.beforeVisibleState, afterView: input.visibleState,
      lockedIntents: input.lockedIntents, persistedPlan: input.persistedPlan,
      persistedResolutions: input.resolutions, visibleOperations: input.visibleOperations,
      visibleEvents: input.visibleEvents, toneSettings: { style: "grounded", pacing: "brisk", contentLimits: [] },
      narrativeBrief: input.proposal.narrativeBrief,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.narratorTimeoutMs);
    try {
      let result;
      try {
        result = await this.#client.run(createNarratorAgent(this.#config), JSON.stringify(bounded), {
          context: { abortSignal: controller.signal }, maxTurns: 2, signal: controller.signal,
        });
      } catch (error) {
        throw new Error(controller.signal.aborted ? "NARRATOR_TIMEOUT" : classifyProviderError(error, "NARRATOR"));
      }
      const narration = NarrationSchema.safeParse(result.finalOutput);
      if (!narration.success) throw new Error("NARRATOR_INVALID_OUTPUT");
      validateNarration(narration.data, bounded);
      return narration.data;
    } finally { clearTimeout(timeout); }
  }
}
