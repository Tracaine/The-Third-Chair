import type { PlayerView } from "@third-chair/contracts";
import { Agent } from "@openai/agents";
import { NarrationSchema, type Narration, type NarratorInput as EngineNarratorInput, type NarratorPort } from "@third-chair/engine";
import type { AgentConfig } from "./config.js";
import { buildNarratorInput } from "./context/narrator-context.js";
import { validateNarration } from "./narration-validator.js";
import { loadNarratorPrompt } from "./prompt-loader.js";
import { AgentsSdkRunClient, type AgentRunClient } from "./runner.js";
import { classifyProviderError, SanitizedProviderError } from "./provider-error.js";

export interface NarratorRunContext { readonly abortSignal: AbortSignal; }
export interface NarratorAdapterOptions { readonly config: AgentConfig; readonly runClient?: AgentRunClient; }

export function createNarratorAgent(config: AgentConfig) {
  return new Agent<NarratorRunContext, typeof NarrationSchema>({
    name: "Third Chair Narrator", instructions: loadNarratorPrompt(), model: config.narratorModel,
    modelSettings: { reasoning: { effort: config.narratorReasoning }, text: { verbosity: "low" } },
    tools: [], outputType: NarrationSchema,
  });
}

function recentSceneView(view: PlayerView, requiredEvents: readonly string[]): PlayerView {
  const required = new Set(requiredEvents);
  const recentEvents = new Set(view.events.slice(-8).map(({ id }) => id));
  return {
    ...view,
    events: view.events.filter(({ id }) => required.has(id) || recentEvents.has(id)),
    facts: view.facts.slice(-8),
    npcs: view.npcs.slice(-8),
    factions: view.factions.slice(-4),
    clocks: view.clocks.slice(-4),
    openThreads: view.openThreads.slice(-6),
    ...(view.knownLocations ? { knownLocations: view.knownLocations.slice(-4) } : {}),
  };
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
      beforeView: recentSceneView(input.beforeVisibleState, input.proposal.narrativeBrief.requiredEventIds),
      afterView: recentSceneView(input.visibleState, input.proposal.narrativeBrief.requiredEventIds),
      lockedIntents: input.lockedIntents, persistedPlan: input.persistedPlan,
      persistedResolutions: input.resolutions, visibleOperations: input.visibleOperations,
      visibleEvents: input.visibleEvents, toneSettings: { style: "grounded", pacing: "brisk", contentLimits: [] },
      narrativeBrief: input.proposal.narrativeBrief,
    });
    return this.#run(bounded);
  }

  async narrateOpening(view: PlayerView, opening: string): Promise<string> {
    const bounded = buildNarratorInput({
      beforeView: view, afterView: view, lockedIntents: [], persistedResolutions: [],
      visibleOperations: [], visibleEvents: [],
      toneSettings: { style: "Opening scene before either player has acted", pacing: "brisk", contentLimits: [] },
      narrativeBrief: { summary: view.currentDecision.situation || opening.slice(0, 2000), requiredResolutionIds: [], requiredEventIds: [] },
    });
    const narration = await this.#run(bounded);
    return [narration.sceneText, ...narration.spokenNpcLines].join("\n").slice(0, 8000);
  }

  async #run(bounded: ReturnType<typeof buildNarratorInput>): Promise<Narration> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.narratorTimeoutMs);
    try {
      let result;
      try {
        result = await this.#client.run(createNarratorAgent(this.#config), JSON.stringify(bounded), {
          context: { abortSignal: controller.signal }, maxTurns: 2, signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("NARRATOR_TIMEOUT");
        throw new SanitizedProviderError(classifyProviderError(error, "NARRATOR"), undefined);
      }
      const narration = NarrationSchema.safeParse(result.finalOutput);
      if (!narration.success) throw new Error("NARRATOR_INVALID_OUTPUT");
      validateNarration(narration.data, bounded);
      return narration.data;
    } finally { clearTimeout(timeout); }
  }
}
