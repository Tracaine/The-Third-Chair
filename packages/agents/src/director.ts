import { Agent, type Tool } from "@openai/agents";
import { TurnProposalSchema, type ActorIntent, type CheckResolution, type SourcePackService, type TurnProposal } from "@third-chair/contracts";
import { InvalidDirectorProposalError, type DirectorInput, type DirectorPort, type DirectorRepairInput } from "@third-chair/engine";
import type { AgentConfig } from "./config.js";
import { buildDirectorInput } from "./context/director-context.js";
import { loadDirectorPrompt } from "./prompt-loader.js";
import { AgentsSdkRunClient, type AgentRunClient, type SafeUsageCounters } from "./runner.js";
import { serializeDirectorRepairInput } from "./repair.js";
import { classifyProviderError } from "./provider-error.js";
import { createDirectorTools, type DirectorRunContext } from "./tools/index.js";

export interface DirectorMetrics {
  readonly role: "director";
  readonly profile: { readonly model: string; readonly reasoning: AgentConfig["directorReasoning"]; readonly verbosity: "low" };
  readonly usage: SafeUsageCounters;
  readonly elapsedMs: number;
  readonly invokedToolNames: readonly string[];
}

export interface DirectorAdapterOptions {
  readonly config: AgentConfig;
  readonly sourcePack: SourcePackService;
  readonly runClient?: AgentRunClient;
  readonly tools?: readonly Tool<DirectorRunContext>[];
  readonly onMetrics?: (metrics: DirectorMetrics) => void;
}

export function createDirectorAgent(config: AgentConfig, tools: readonly Tool<DirectorRunContext>[]) {
  return new Agent<DirectorRunContext, typeof TurnProposalSchema>({
    name: "Third Chair Director", instructions: loadDirectorPrompt(), model: config.directorModel,
    modelSettings: { reasoning: { effort: config.directorReasoning }, text: { verbosity: "low" }, parallelToolCalls: false },
    tools: [...tools], outputType: TurnProposalSchema,
  });
}

function requireLockedIntents(input: DirectorInput): void {
  const seen = new Set<string>();
  for (const intent of input.intents) {
    if (seen.has(intent.actorId) || input.state.actors[intent.actorId]?.controller !== intent.seat
      || !input.state.currentDecision.eligibleActorIds.includes(intent.actorId)) {
      throw new Error("DIRECTOR_INTENT_AUTHORITY_VIOLATION");
    }
    seen.add(intent.actorId);
  }
  const owner = input.state.currentDecision.owner;
  const required = owner === "BOTH" ? ["BILL", "RAVEN"] : owner === "DIRECTOR" ? [] : [owner];
  if (required.some((seat) => !input.intents.some((intent) => intent.seat === seat))) {
    throw new Error("DIRECTOR_MISSING_INTENT");
  }
}

// These are structured event kinds, not heuristics over character names or prose.
const agencyKinds = new Set(["action", "dialogue", "thought", "consent", "reaction", "resource_commitment"]);
function validateBoundaries(input: DirectorInput, proposal: TurnProposal, resolutions: readonly CheckResolution[]): void {
  const intentFor = (id: string): ActorIntent | undefined => input.intents.find((intent) => intent.actorId === id && intent.mode === "ACT");
  const directorOwns = (id: string): boolean => input.state.actors[id]
    ? input.state.actors[id]!.controller === "DIRECTOR" : input.state.npcs[id] !== undefined;
  const inventoryOwners = new Map(Object.values(input.state.inventory)
    .map((item) => [item.id, item.ownerActorId] as const));
  const reservedInventoryIds = new Set(inventoryOwners.keys());
  const failAgency: () => never = () => { throw new Error("DIRECTOR_PLAYER_AUTHORITY_VIOLATION"); };
  if (proposal.narrativeBrief.requiredResolutionIds.some((id) => !resolutions.some((result) => result.id === id))) {
    throw new Error("DIRECTOR_UNKNOWN_RESOLUTION");
  }
  for (const operation of proposal.checkLinkedOperations) {
    if (operation.cause.type !== "RESOLUTION") throw new Error("DIRECTOR_UNKNOWN_RESOLUTION");
  }
  for (const operation of [...proposal.uncontestedOperations, ...proposal.checkLinkedOperations]) {
    const cause = operation.cause;
    if (cause.type === "RESOLUTION") {
      const result = resolutions.find((result) => result.id === cause.resolutionId);
      if (!result) throw new Error("DIRECTOR_UNKNOWN_RESOLUTION");
      if (!cause.allowedOutcomeTiers.includes(result.tier)) throw new Error("DIRECTOR_OUTCOME_TIER_MISMATCH");
    }
    if (cause.type === "UNCONTESTED") {
      if (!intentFor(cause.intentActorId) && !directorOwns(cause.intentActorId)) failAgency();
      if ("actorId" in operation && operation.actorId !== cause.intentActorId) failAgency();
      if (operation.kind === "ADD_EVENT" && operation.intentActorId != null
        && operation.intentActorId !== cause.intentActorId) failAgency();
    }
    if (operation.kind === "ADD_EVENT") {
      const id = operation.intentActorId;
      const actor = id == null ? undefined : input.state.actors[id];
      if (id != null && !actor && !input.state.npcs[id]) failAgency();
      if (actor?.controller === "BILL" || actor?.controller === "RAVEN") {
        // ActorIntent represents an action, not a speech/thought/consent modality.
        if (operation.event.kind.toLowerCase() !== "action"
          || operation.event.text !== intentFor(id!)?.declaredAction) failAgency();
      } else if (id == null && agencyKinds.has(operation.event.kind.toLowerCase())) failAgency();
    }
    if (operation.kind === "SPEND_RESOURCE" || operation.kind === "MOVE_ACTOR") {
      const actor = input.state.actors[operation.actorId];
      if (actor?.controller === "BILL" || actor?.controller === "RAVEN") {
        // ActorIntent commits IDs, never quantities. No exact spend authority exists.
        if (operation.kind === "SPEND_RESOURCE") failAgency();
        const intent = intentFor(operation.actorId);
        if (!intent || (cause.type === "UNCONTESTED" && cause.intentActorId !== operation.actorId)) failAgency();
        if (!intent.targetIds.includes(operation.locationId)) failAgency();
      }
    }
    if (operation.kind === "REMOVE_INVENTORY" || operation.kind === "SET_EQUIPPED") {
      const owner = inventoryOwners.get(operation.itemId);
      const actor = owner ? input.state.actors[owner] : undefined;
      if (owner && cause.type === "UNCONTESTED" && cause.intentActorId !== owner) failAgency();
      if (owner && (actor?.controller === "BILL" || actor?.controller === "RAVEN")) {
        // Neither equipping nor unequipping slots is represented in ActorIntent.
        if (operation.kind === "SET_EQUIPPED") failAgency();
        const intent = intentFor(owner);
        if (!intent?.committedResourceIds.includes(operation.itemId)) failAgency();
      }
      if (operation.kind === "REMOVE_INVENTORY") inventoryOwners.delete(operation.itemId);
    }
    if (operation.kind === "ADD_INVENTORY") {
      if (reservedInventoryIds.has(operation.item.id)) failAgency();
      const owner = operation.item.ownerActorId;
      const actor = owner ? input.state.actors[owner] : undefined;
      if (operation.item.equippedSlots.length > 0
        && (actor?.controller === "BILL" || actor?.controller === "RAVEN")) failAgency();
      if (owner && cause.type === "UNCONTESTED" && cause.intentActorId !== owner
        && (directorOwns(owner) || operation.item.equippedSlots.length > 0)) failAgency();
      inventoryOwners.set(operation.item.id, owner);
      reservedInventoryIds.add(operation.item.id);
    }
  }
}

function freezeIntents(intents: readonly ActorIntent[]): ActorIntent[] {
  const copy = structuredClone([...intents]);
  for (const intent of copy) {
    Object.freeze(intent.targetIds); Object.freeze(intent.committedResourceIds); Object.freeze(intent);
  }
  Object.freeze(copy);
  return copy;
}

function pointer(path: readonly PropertyKey[]): string {
  return `/${path.map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
}

function safeIssue(error: unknown, path = "/"): { path: string; message: string } {
  const message = error instanceof Error && /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message)
    ? error.message : "DIRECTOR_PROPOSAL_INVALID";
  return { path, message };
}

export class OpenAiDirectorAdapter implements DirectorPort {
  readonly #options: DirectorAdapterOptions;
  readonly #client: AgentRunClient;
  readonly #tools: readonly Tool<DirectorRunContext>[];

  constructor(options: DirectorAdapterOptions) {
    this.#options = options;
    this.#client = options.runClient ?? new AgentsSdkRunClient(options.config.traceMode);
    this.#tools = [...(options.tools ?? createDirectorTools())];
  }

  async propose(input: DirectorInput): Promise<TurnProposal> {
    requireLockedIntents(input);
    let bounded;
    try {
      bounded = buildDirectorInput({ worldState: input.state, lockedIntents: input.intents,
        persistedPlan: input.persistedPlan, persistedResolutions: input.persistedResolutions });
    } catch { throw new Error("DIRECTOR_INVALID_INPUT"); }
    const config = this.#options.config;
    const agent = createDirectorAgent(config, this.#tools);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.directorTimeoutMs);
    const started = performance.now();
    const invokedToolNames = new Set<string>();
    const suppliedNames = new Set(this.#tools.map((tool) => tool.name));
    let persistedResolutions = [...input.persistedResolutions];
    const context: DirectorRunContext = {
      turnId: input.turnId, campaignId: input.state.metadata.campaignId,
      sourcePack: this.#options.sourcePack, intentsLocked: true, lockedIntents: freezeIntents(bounded.lockedIntents),
      abortSignal: controller.signal,
      lockAndResolveChecks: (plan) => {
        controller.signal.throwIfAborted();
        const result = input.runtime.lockAndResolveChecks(plan);
        persistedResolutions = [...result.resolutions];
        return result;
      },
    };
    try {
      let result;
      try {
        result = await this.#client.run(agent, JSON.stringify(bounded), {
          context, maxTurns: 10, signal: controller.signal, toolExecution: { maxFunctionToolConcurrency: 1 },
          onToolInvoked: (name) => { if (suppliedNames.has(name)) invokedToolNames.add(name); },
        });
      } catch (error) {
        throw new Error(controller.signal.aborted ? "DIRECTOR_TIMEOUT" : classifyProviderError(error, "DIRECTOR"));
      }
      if (controller.signal.aborted) throw new Error("DIRECTOR_TIMEOUT");
      // Metrics carry aggregates only. Telemetry failures cannot change adjudication.
      try {
        this.#options.onMetrics?.({ role: "director",
          profile: { model: config.directorModel, reasoning: config.directorReasoning, verbosity: "low" },
          usage: { requests: result.usage.requests, inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens, totalTokens: result.usage.totalTokens },
          elapsedMs: Math.max(0, performance.now() - started), invokedToolNames: [...invokedToolNames],
        });
      } catch { /* Telemetry is not turn authority. */ }
      const parsed = TurnProposalSchema.safeParse(result.finalOutput);
      if (!parsed.success) throw new InvalidDirectorProposalError(result.finalOutput,
        parsed.error.issues.slice(0, 20).map((issue) => ({ path: pointer(issue.path), message: "INVALID_VALUE" })));
      try { validateBoundaries(input, parsed.data, persistedResolutions); }
      catch (error) { const issue = safeIssue(error); throw new InvalidDirectorProposalError(parsed.data, [issue], issue.message); }
      return parsed.data;
    } finally { clearTimeout(timeout); }
  }

  async repair(repairInput: DirectorRepairInput, authoritative: DirectorInput): Promise<TurnProposal> {
    requireLockedIntents(authoritative);
    const serialized = serializeDirectorRepairInput(repairInput);
    const config = this.#options.config;
    const agent = createDirectorAgent(config, this.#tools);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.directorTimeoutMs);
    let persistedResolutions = [...authoritative.persistedResolutions];
    const context: DirectorRunContext = {
      turnId: authoritative.turnId, campaignId: authoritative.state.metadata.campaignId,
      sourcePack: this.#options.sourcePack, intentsLocked: true,
      lockedIntents: freezeIntents(authoritative.intents), abortSignal: controller.signal,
      lockAndResolveChecks: (plan) => {
        controller.signal.throwIfAborted();
        if (repairInput.lockedPlanId === null || plan.id !== repairInput.lockedPlanId) {
          throw new Error("LOCKED_PLAN_MISMATCH");
        }
        const result = authoritative.runtime.lockAndResolveChecks(plan);
        persistedResolutions = [...result.resolutions];
        return result;
      },
    };
    try {
      let result;
      try {
        result = await this.#client.run(agent, serialized, {
          context, maxTurns: 10, signal: controller.signal,
          toolExecution: { maxFunctionToolConcurrency: 1 },
        });
      } catch (error) {
        throw new Error(controller.signal.aborted ? "DIRECTOR_TIMEOUT"
          : classifyProviderError(error, "DIRECTOR", "DIRECTOR_REPAIR_RUN_FAILED"));
      }
      const parsed = TurnProposalSchema.safeParse(result.finalOutput);
      if (!parsed.success) throw new InvalidDirectorProposalError(result.finalOutput,
        parsed.error.issues.slice(0, 20).map((issue) => ({ path: pointer(issue.path), message: "INVALID_VALUE" })));
      try { validateBoundaries(authoritative, parsed.data, persistedResolutions); }
      catch (error) { const issue = safeIssue(error); throw new InvalidDirectorProposalError(parsed.data, [issue], issue.message); }
      return parsed.data;
    } finally { clearTimeout(timeout); }
  }
}
