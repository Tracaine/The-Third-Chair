import { describe, expect, test, vi } from "vitest";
import * as agents from "../src/index.js";
import { directorInput, sourcePack } from "./director-fixtures.js";

describe("provider error classification", () => {
  test.each([
    [{ status: 429, code: "insufficient_quota" }, "DIRECTOR_QUOTA_EXHAUSTED"],
    [{ status: 429, code: "rate_limit_exceeded" }, "DIRECTOR_RATE_LIMITED"],
    [{ status: 401, code: "invalid_api_key" }, "DIRECTOR_AUTHENTICATION_FAILED"],
    [{ status: 403 }, "DIRECTOR_ACCESS_DENIED"],
    [{ status: 404, code: "model_not_found" }, "DIRECTOR_MODEL_UNAVAILABLE"],
    [{ name: "APIConnectionError" }, "DIRECTOR_TRANSPORT_FAILED"],
    [{ status: 503 }, "DIRECTOR_PROVIDER_UNAVAILABLE"],
    [{ name: "UserError" }, "DIRECTOR_SDK_CONFIGURATION_FAILED"],
    [{ name: "ModelBehaviorError" }, "DIRECTOR_MODEL_BEHAVIOR_FAILED"],
  ])("maps safe provider metadata without preserving messages", (failure, expected) => {
    expect(agents.classifyProviderError({ ...failure, message: "secret provider details" }, "DIRECTOR")).toBe(expected);
  });

  test("unwraps a provider error from a cause", () => {
    expect(agents.classifyProviderError({ cause: { status: 429, type: "insufficient_quota" } }, "NARRATOR"))
      .toBe("NARRATOR_QUOTA_EXHAUSTED");
  });

  test("retains only bounded provider diagnostics for private development", () => {
    const diagnostic = agents.providerFailureDiagnostic({
      cause: {
        status: 400,
        code: "invalid_function_parameters",
        type: "invalid_request_error",
        param: "tools[2].parameters",
        name: "BadRequestError",
        requestID: "req_safe_123",
        message: "secret provider details",
        headers: { authorization: "secret" },
      },
    });
    expect(diagnostic).toEqual({
      status: 400,
      code: "invalid_function_parameters",
      type: "invalid_request_error",
      param: "tools[2].parameters",
      name: "BadRequestError",
      requestId: "req_safe_123",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
  });

  test("walks the SDK tool-error wrapper without retaining its messages or state", () => {
    const diagnostic = agents.providerFailureDiagnostic({
      name: "ToolCallError",
      message: "contains model-produced arguments",
      state: { history: "secret" },
      error: { name: "InvalidToolInputError", message: "invalid raw input" },
    });
    expect(diagnostic).toEqual({ name: "ToolCallError", causeName: "InvalidToolInputError" });
    expect(JSON.stringify(diagnostic)).not.toMatch(/model-produced|raw input|history|secret/);
    expect(agents.classifyProviderError({
      name: "ToolCallError", error: { name: "InvalidToolInputError" },
    }, "DIRECTOR")).toBe("DIRECTOR_TOOL_INPUT_INVALID");
  });

  test("director preserves safe diagnostics without exposing the provider message", async () => {
    const run = vi.fn(async (_agent, _input, options) => {
      options.onToolInvoked?.("search_lore_internal");
      throw {
        status: 400, code: "invalid_function_parameters", type: "invalid_request_error",
        param: "tools[2].parameters", requestID: "req_safe_123", message: "account details",
      };
    });
    const director = new agents.OpenAiDirectorAdapter({
      config: agents.loadAgentConfig({}), sourcePack, runClient: { run }, preserveProviderDiagnostics: true,
    });
    const error = await director.propose(directorInput()).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(agents.SanitizedProviderError);
    expect(error).toMatchObject({
      message: "DIRECTOR_REQUEST_REJECTED",
      diagnostic: {
        status: 400, code: "invalid_function_parameters", type: "invalid_request_error",
        param: "tools[2].parameters", requestId: "req_safe_123", toolName: "search_lore_internal",
      },
    });
    expect(JSON.stringify(error)).not.toContain("account details");
  });

  test("normal play discards even the bounded diagnostic", async () => {
    const run = vi.fn().mockRejectedValue({
      status: 400, param: "tools[2].parameters", requestID: "req_safe_123", message: "account details",
    });
    const director = new agents.OpenAiDirectorAdapter({
      config: agents.loadAgentConfig({}), sourcePack, runClient: { run },
    });
    const error = await director.propose(directorInput()).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(agents.SanitizedProviderError);
    expect(error).toMatchObject({ message: "DIRECTOR_REQUEST_REJECTED", diagnostic: {} });
    expect(JSON.stringify(error)).not.toContain("req_safe_123");
  });
});
