import { describe, expect, it } from "vitest";
import { loadAgentConfig } from "../src/config.js";

describe("loadAgentConfig", () => {
  it("loads the bounded runtime defaults", () => {
    expect(loadAgentConfig({})).toEqual({
      directorModel: "gpt-5.6-sol",
      directorReasoning: "high",
      narratorModel: "gpt-5.6-sol",
      narratorReasoning: "medium",
      traceMode: "off",
      directorTimeoutMs: 60_000,
      narratorTimeoutMs: 45_000,
    });
  });

  it("rejects every non-Sol model override", () => {
    expect(() => loadAgentConfig({ DIRECTOR_MODEL: "unsupported-model" })).toThrow();
    expect(() => loadAgentConfig({ NARRATOR_MODEL: "unsupported-model" })).toThrow();
    expect(loadAgentConfig({
      DIRECTOR_MODEL: "gpt-5.6-sol",
      NARRATOR_MODEL: "gpt-5.6-sol",
    })).toMatchObject({
      directorModel: "gpt-5.6-sol",
      narratorModel: "gpt-5.6-sol",
    });
  });

  it("rejects unsupported reasoning and trace values", () => {
    expect(() => loadAgentConfig({ DIRECTOR_REASONING: "extreme" })).toThrow();
    expect(() => loadAgentConfig({ THIRD_CHAIR_TRACE_MODE: "on" })).toThrow();
  });

  it("maps bounded timeout environment values", () => {
    expect(loadAgentConfig({
      DIRECTOR_TIMEOUT_MS: "1000",
      NARRATOR_TIMEOUT_MS: "120000",
    })).toMatchObject({
      directorTimeoutMs: 1_000,
      narratorTimeoutMs: 120_000,
    });

    expect(() => loadAgentConfig({ DIRECTOR_TIMEOUT_MS: "999" })).toThrow();
    expect(() => loadAgentConfig({ NARRATOR_TIMEOUT_MS: "120001" })).toThrow();
  });

  it("allows private tracing only behind the explicit development gate", () => {
    const privateTrace = { THIRD_CHAIR_TRACE_MODE: "private_dev" };

    expect(() => loadAgentConfig(privateTrace)).toThrow();
    expect(() => loadAgentConfig({ ...privateTrace, NODE_ENV: "development" })).toThrow();
    expect(() => loadAgentConfig({ ...privateTrace, THIRD_CHAIR_PRIVATE_DEV: "1" })).toThrow();
    expect(loadAgentConfig({
      ...privateTrace,
      NODE_ENV: "development",
      THIRD_CHAIR_PRIVATE_DEV: "1",
    }).traceMode).toBe("private_dev");
  });
});
