import { describe, expect, test } from "vitest";
import { zodResponseFormat } from "openai/helpers/zod";
import { TurnProposalSchema } from "@third-chair/contracts";
import { createDirectorTools } from "../src/tools/index.js";

function assertStrictApiSchema(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertStrictApiSchema(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const schema = value as Record<string, unknown>;
  expect(Object.keys(schema), `${path} must not contain an unconstrained schema`).not.toHaveLength(0);
  if (schema.type === "object" && typeof schema.properties === "object" && schema.properties !== null) {
    const propertyNames = Object.keys(schema.properties);
    expect(schema.additionalProperties, `${path}.additionalProperties`).toBe(false);
    expect(schema.required, `${path}.required`).toEqual(propertyNames);
  }
  for (const [key, child] of Object.entries(schema)) assertStrictApiSchema(child, `${path}.${key}`);
}

describe("live structured output schemas", () => {
  test("Director proposal is accepted by the Responses API strict-schema helper", () => {
    const format = zodResponseFormat(TurnProposalSchema, "turn_proposal");
    expect(() => format).not.toThrow();
    assertStrictApiSchema(format.json_schema.schema, "$.directorOutput");
  });

  test("complete Director tool set generates strict Responses API schemas", () => {
    const tools = createDirectorTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "search_rules_internal",
      "search_lore_internal",
      "search_timeline_internal",
      "get_entity_internal",
      "lock_and_resolve_checks",
    ]);
    for (const tool of tools) {
      expect(tool.strict, `${tool.name}.strict`).toBe(true);
      assertStrictApiSchema(tool.parameters, `$.tools.${tool.name}.parameters`);
      if (tool.outputSchema !== undefined) {
        assertStrictApiSchema(tool.outputSchema, `$.tools.${tool.name}.outputSchema`);
      }
    }
  });
});
