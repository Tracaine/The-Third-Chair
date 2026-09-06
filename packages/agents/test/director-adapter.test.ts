import { describe, expect, test, vi } from "vitest";
import { RunContext } from "@openai/agents";
import { TurnProposalSchema } from "@third-chair/contracts";
import * as agents from "../src/index.js";
import type { AgentRunClient } from "../src/runner.js";
import { directorInput, proposal, sourcePack, usage } from "./director-fixtures.js";

describe("Director adapter", () => {
  test("runs a fresh bounded structured agent with only supplied tools and local capabilities", async () => {
    const config = agents.loadAgentConfig({ DIRECTOR_MODEL: "gpt-5.6-sol", DIRECTOR_REASONING: "medium" });
    const tools = agents.createRetrievalTools();
    const seen: unknown[] = [];
    const run: AgentRunClient["run"] = async (agent, input, options) => {
      seen.push(agent);
      expect(agent.name).toBe("Third Chair Director");
      expect(agent.model).toBe("gpt-5.6-sol");
      expect(agent.modelSettings).toEqual({ reasoning: { effort: "medium" }, text: { verbosity: "low" }, parallelToolCalls: false });
      expect(agent.tools).toEqual(tools);
      expect(agent.outputType).toBe(TurnProposalSchema);
      expect(agent.handoffs).toEqual([]);
      expect(Object.keys(options).sort()).toEqual(["context", "maxTurns", "onToolInvoked", "signal", "toolExecution"]);
      expect(options.maxTurns).toBe(10);
      expect(options.toolExecution).toEqual({ maxFunctionToolConcurrency: 1 });
      expect(options.signal.aborted).toBe(false);
      const local = options.context as agents.DirectorRunContext;
      expect(local.turnId).toBe("test_turn");
      expect(local.sourcePack).toBe(sourcePack);
      expect(local.abortSignal).toBe(options.signal);
      expect(local.intentsLocked).toBe(true);
      expect(Object.isFrozen(local.lockedIntents[0]?.targetIds)).toBe(true);
      const bounded = JSON.parse(input);
      expect(agents.DirectorInputSchema.safeParse(bounded).success).toBe(true);
      expect(bounded.state.actors).toHaveLength(2);
      expect(bounded.persistedPlan).toBe(null);
      expect(input).not.toContain("SENTINEL");
      expect(input).not.toContain("sourcePack");
      expect(input).not.toContain("runtime");
      expect(input).not.toContain("gpt-5.6-sol");
      options.onToolInvoked?.("search_rules_internal");
      options.onToolInvoked?.("SENTINEL_FAKE_TOOL");
      return { finalOutput: proposal(), usage };
    };
    const onMetrics = vi.fn();
    const adapter = new agents.OpenAiDirectorAdapter({ config, sourcePack, tools, runClient: { run }, onMetrics });
    const input = directorInput();
    input.state.facts.push({ id: "test_unrelated", audience: "DIRECTOR", kind: "secret", text: "SENTINEL_UNRELATED" });
    expect(await adapter.propose(input)).toEqual(proposal());
    expect(await adapter.propose(input)).toEqual(proposal());
    expect(seen[0]).not.toBe(seen[1]);
    expect(onMetrics.mock.calls[0]?.[0]).toEqual({
      role: "director", profile: { model: "gpt-5.6-sol", reasoning: "medium", verbosity: "low" },
      usage, elapsedMs: expect.any(Number), invokedToolNames: ["search_rules_internal"],
    });
  });

  test("reparses final output and suppresses malformed hidden output and provider errors", async () => {
    for (const finalOutput of [undefined, { SENTINEL_SECRET: true }, { ...proposal(), narrativeBrief: { summary: "SENTINEL_SECRET" } }]) {
      const adapter = new agents.OpenAiDirectorAdapter({ config: agents.loadAgentConfig({}), sourcePack,
        runClient: { run: async () => ({ finalOutput, usage }) } });
      await expect(adapter.propose(directorInput())).rejects.toThrow("DIRECTOR_INVALID_OUTPUT");
    }
    const adapter = new agents.OpenAiDirectorAdapter({ config: agents.loadAgentConfig({}), sourcePack,
      runClient: { run: async () => { throw new Error("SENTINEL_PROVIDER_INPUT"); } } });
    await expect(adapter.propose(directorInput())).rejects.toThrow(/^DIRECTOR_RUN_FAILED$/);
  });

  test("timeout aborts the local run and cannot return a late proposal", async () => {
    vi.useFakeTimers();
    try {
      const adapter = new agents.OpenAiDirectorAdapter({ config: agents.loadAgentConfig({ DIRECTOR_TIMEOUT_MS: "1000" }), sourcePack,
        runClient: { run: async (_agent, _input, options) => {
          await new Promise<void>((resolve) => options.signal.addEventListener("abort", () => resolve(), { once: true }));
          return { finalOutput: proposal(), usage };
        } } });
      const pending = expect(adapter.propose(directorInput())).rejects.toThrow(/^DIRECTOR_TIMEOUT$/);
      await vi.advanceTimersByTimeAsync(1000);
      await pending;
    } finally { vi.useRealTimers(); }
  });

  test("runner seam reports only invoked supplied tool names and removes its listener", async () => {
    const tool = agents.createRetrievalTools()[0]!;
    const agent = agents.createDirectorAgent(agents.loadAgentConfig({}), [tool]);
    const client = new agents.AgentsSdkRunClient("off", { setTracingDisabled: () => {}, createRunner: () => ({
      run: async (runningAgent, _input, options) => {
        expect(options).not.toHaveProperty("onToolInvoked");
        runningAgent.emit("agent_tool_start", new RunContext(options.context), tool, { toolCall: {} as never });
        return { finalOutput: proposal(), state: { usage } };
      },
    }) });
    const onToolInvoked = vi.fn();
    await client.run(agent, "bounded", { context: {} as agents.DirectorRunContext, maxTurns: 10, signal: new AbortController().signal, onToolInvoked });
    expect(onToolInvoked.mock.calls).toEqual([["search_rules_internal"]]);
    agent.emit("agent_tool_start", new RunContext({} as agents.DirectorRunContext), tool, { toolCall: {} as never });
    expect(onToolInvoked).toHaveBeenCalledTimes(1);
  });
});
