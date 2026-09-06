import { z } from "zod";

export const AgentConfigSchema = z.object({
  directorModel: z.literal("gpt-5.6-sol").default("gpt-5.6-sol"),
  directorReasoning: z.enum(["low", "medium", "high", "xhigh", "max"]).default("high"),
  narratorModel: z.literal("gpt-5.6-sol").default("gpt-5.6-sol"),
  narratorReasoning: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
  traceMode: z.enum(["off", "private_dev"]).default("off"),
  directorTimeoutMs: z.number().int().min(1_000).max(120_000).default(90_000),
  narratorTimeoutMs: z.number().int().min(1_000).max(120_000).default(45_000),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentEnvironment = Readonly<Record<string, string | undefined>>;

function optionalInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer`);
  return Number(value);
}

export function loadAgentConfig(env: AgentEnvironment): AgentConfig {
  const config = AgentConfigSchema.parse({
    directorModel: env.DIRECTOR_MODEL,
    directorReasoning: env.DIRECTOR_REASONING,
    narratorModel: env.NARRATOR_MODEL,
    narratorReasoning: env.NARRATOR_REASONING,
    traceMode: env.THIRD_CHAIR_TRACE_MODE,
    directorTimeoutMs: optionalInteger(env.DIRECTOR_TIMEOUT_MS, "DIRECTOR_TIMEOUT_MS"),
    narratorTimeoutMs: optionalInteger(env.NARRATOR_TIMEOUT_MS, "NARRATOR_TIMEOUT_MS"),
  });

  if (
    config.traceMode === "private_dev"
    && (env.NODE_ENV !== "development" || env.THIRD_CHAIR_PRIVATE_DEV !== "1")
  ) {
    throw new Error(
      "private_dev tracing requires NODE_ENV=development and THIRD_CHAIR_PRIVATE_DEV=1",
    );
  }

  return config;
}
