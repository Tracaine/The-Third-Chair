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

  test("director exposes only the sanitized failure class", async () => {
    const run = vi.fn().mockRejectedValue({ status: 429, code: "insufficient_quota", message: "account details" });
    const director = new agents.OpenAiDirectorAdapter({
      config: agents.loadAgentConfig({}), sourcePack, runClient: { run },
    });
    await expect(director.propose(directorInput())).rejects.toThrow(/^DIRECTOR_QUOTA_EXHAUSTED$/);
  });
});
