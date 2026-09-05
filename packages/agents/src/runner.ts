import {
  Runner,
  setTracingDisabled,
  type Agent,
  type AgentOutputType,
  type RunConfig,
} from "@openai/agents";
import type { AgentConfig } from "./config.js";

export interface SafeUsageCounters {
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface AgentRunResult {
  readonly finalOutput: unknown;
  readonly usage: SafeUsageCounters;
}

export interface AgentRunOptions<TContext> {
  readonly context: TContext;
  readonly maxTurns: number;
  readonly signal: AbortSignal;
  readonly toolExecution?: { readonly maxFunctionToolConcurrency: number };
  /** Name-only application event; no SDK context, arguments, output, or history. */
  readonly onToolInvoked?: (name: string) => void;
}

interface AgentsSdkResult {
  readonly finalOutput?: unknown;
  readonly state: {
    readonly usage: Partial<SafeUsageCounters>;
  };
}

export interface AgentsSdkRunner {
  run<TContext, TOutput extends AgentOutputType>(
    agent: Agent<TContext, TOutput>,
    input: string,
    options: AgentRunOptions<TContext>,
  ): Promise<AgentsSdkResult>;
}

export type AgentsSdkRunnerFactory = (config: Partial<RunConfig>) => AgentsSdkRunner;

export interface AgentsSdkRunClientDependencies {
  readonly createRunner?: AgentsSdkRunnerFactory;
  readonly setTracingDisabled?: (disabled: boolean) => void;
}

export interface AgentRunClient {
  run<TContext, TOutput extends AgentOutputType>(
    agent: Agent<TContext, TOutput>,
    input: string,
    options: AgentRunOptions<TContext>,
  ): Promise<AgentRunResult>;
}

const createDefaultRunner: AgentsSdkRunnerFactory = (config) => {
  const runner = new Runner(config);
  return {
    run: async (agent, input, options) => runner.run(agent, input, options),
  };
};

function safeCounter(value: number | undefined): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export class AgentsSdkRunClient implements AgentRunClient {
  readonly #runner: AgentsSdkRunner;

  constructor(
    traceMode: AgentConfig["traceMode"],
    dependencies: AgentsSdkRunClientDependencies = {},
  ) {
    const configureTracing = dependencies.setTracingDisabled ?? setTracingDisabled;
    configureTracing(traceMode === "off");

    const createRunner = dependencies.createRunner ?? createDefaultRunner;
    this.#runner = createRunner(
      traceMode === "private_dev"
        ? { tracingDisabled: false, traceIncludeSensitiveData: false }
        : { tracingDisabled: true },
    );
  }

  async run<TContext, TOutput extends AgentOutputType>(
    agent: Agent<TContext, TOutput>,
    input: string,
    options: AgentRunOptions<TContext>,
  ): Promise<AgentRunResult> {
    const { onToolInvoked, ...sdkOptions } = options;
    const reportTool: Parameters<typeof agent.on<"agent_tool_start">>[1] = (_context, tool) => {
      if (agent.tools.includes(tool)) onToolInvoked?.(tool.name);
    };
    agent.on("agent_tool_start", reportTool);
    let result: AgentsSdkResult;
    try {
      result = await this.#runner.run(agent, input, sdkOptions);
    } finally {
      agent.off("agent_tool_start", reportTool);
    }
    const usage = result.state.usage;

    return {
      finalOutput: result.finalOutput,
      usage: {
        requests: safeCounter(usage.requests),
        inputTokens: safeCounter(usage.inputTokens),
        outputTokens: safeCounter(usage.outputTokens),
        totalTokens: safeCounter(usage.totalTokens),
      },
    };
  }
}
