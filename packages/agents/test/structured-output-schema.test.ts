import { describe, expect, test } from "vitest";
import { zodResponseFormat } from "openai/helpers/zod";
import { TurnProposalSchema } from "@third-chair/contracts";

describe("live structured output schemas", () => {
  test("Director proposal is accepted by the Responses API strict-schema helper", () => {
    expect(() => zodResponseFormat(TurnProposalSchema, "turn_proposal")).not.toThrow();
  });
});
