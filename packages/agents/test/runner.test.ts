import { Agent, tool } from "@openai/agents";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AgentsSdkRunClient,
  type AgentsSdkRunner,
  type AgentsSdkRunnerFactory,
} from "../src/runner.js";

describe("AgentsSdkRunClient", () => {
  it("forwards agent configuration and bounded run options without returning SDK history", async () => {
    const outputSchema = z.object({ answer: z.string() });
    const lookupTool = tool({
      name: "lookup",
      description: "Look up a test value.",
      parameters: z.object({ key: z.string() }),
      execute: ({ key }) => key,
    });
    const signal = AbortSignal.timeout(10_000);
    const context = { turnId: "turn-7" };
    const agent = new Agent<typeof context, typeof outputSchema>({
      name: "Director",
      instructions: "Use only bounded input.",
      model: "gpt-5.6-sol",
      modelSettings: {
        reasoning: { effort: "high" },
        text: { verbosity: "low" },
        parallelToolCalls: false,
      },
      tools: [lookupTool],
      outputType: outputSchema,
    });
    const run = vi.fn(async (receivedAgent, input, options) => {
      expect(receivedAgent.model).toBe("gpt-5.6-sol");
      expect(receivedAgent.modelSettings).toEqual({
        reasoning: { effort: "high" },
        text: { verbosity: "low" },
        parallelToolCalls: false,
      });
      expect(receivedAgent.tools).toEqual([lookupTool]);
      expect(receivedAgent.outputType).toBe(outputSchema);
      expect(input).toBe("bounded input");
      expect(options).toEqual({ maxTurns: 10, signal, context });
      expect(options).not.toHaveProperty("session");

      return {
        finalOutput: { answer: "safe" },
        state: {
          usage: {
            requests: 2,
            inputTokens: 30,
            outputTokens: 7,
            totalTokens: 37,
          },
        },
        history: [{ role: "assistant", content: "must not escape" }],
      };
    });
    const createRunner = vi.fn(() => ({ run }) as unknown as AgentsSdkRunner);
    const setTracingDisabled = vi.fn();
    const client = new AgentsSdkRunClient("private_dev", {
      createRunner: createRunner as AgentsSdkRunnerFactory,
      setTracingDisabled,
    });

    const result = await client.run(agent, "bounded input", {
      maxTurns: 10,
      signal,
      context,
    });

    expect(setTracingDisabled).toHaveBeenCalledOnce();
    expect(setTracingDisabled).toHaveBeenCalledWith(false);
    expect(createRunner).toHaveBeenCalledWith({
      tracingDisabled: false,
      traceIncludeSensitiveData: false,
    });
    expect(result).toEqual({
      finalOutput: { answer: "safe" },
      usage: {
        requests: 2,
        inputTokens: 30,
        outputTokens: 7,
        totalTokens: 37,
      },
    });
    expect(result).not.toHaveProperty("history");
    expect(result).not.toHaveProperty("state");
  });

  it("disables tracing at startup and normalizes absent usage counters", async () => {
    const run = vi.fn(async () => ({
      finalOutput: "ok",
      state: { usage: {} },
      history: [],
    }));
    const createRunner = vi.fn(() => ({ run }) as unknown as AgentsSdkRunner);
    const setTracingDisabled = vi.fn();
    const client = new AgentsSdkRunClient("off", {
      createRunner: createRunner as AgentsSdkRunnerFactory,
      setTracingDisabled,
    });
    const agent = new Agent<{ turnId: string }>({
      name: "Narrator",
      instructions: "Narrate visible facts.",
      model: "gpt-5.6-terra",
      modelSettings: { reasoning: { effort: "medium" } },
      tools: [],
    });

    const result = await client.run(agent, "visible input", {
      maxTurns: 2,
      signal: AbortSignal.timeout(10_000),
      context: { turnId: "turn-8" },
    });

    expect(setTracingDisabled).toHaveBeenCalledOnce();
    expect(setTracingDisabled).toHaveBeenCalledWith(true);
    expect(createRunner).toHaveBeenCalledWith({ tracingDisabled: true });
    expect(result.usage).toEqual({
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });
});
