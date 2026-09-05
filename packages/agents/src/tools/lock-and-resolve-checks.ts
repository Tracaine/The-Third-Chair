import { tool, type RunContext } from "@openai/agents";
import {
  CheckResolutionSchema, PersistedIdSchema, ResolutionPlanSchema,
} from "@third-chair/contracts";
import { z } from "zod";
import { retrievalContext, type DirectorRunContext } from "./context.js";

const OutputSchema = z.object({
  planId: PersistedIdSchema,
  resolutions: z.array(CheckResolutionSchema),
  nextRngCounter: z.number().int().nonnegative(),
  reused: z.boolean(),
}).strict();

export const lockAndResolveChecksTool = tool({
  name: "lock_and_resolve_checks",
  description: "Lock every check and its success/failure stakes before deterministic resolution. Identical retries reuse persisted dice.",
  parameters: ResolutionPlanSchema,
  outputSchema: OutputSchema,
  strict: true,
  timeoutMs: 5_000,
  timeoutBehavior: "raise_exception",
  errorFunction: null,
  async execute(plan, runContext?: RunContext<DirectorRunContext>) {
    const context = retrievalContext(runContext);
    if (!context.intentsLocked) throw new Error("INTENTS_NOT_LOCKED");

    const intentByActor = new Map(context.lockedIntents.map((intent) => [intent.actorId, intent]));
    for (const check of plan.checks) {
      const intent = intentByActor.get(check.actorId);
      if (intent !== undefined && intent.mode !== "ACT") {
        throw new Error("CHECK_NOT_AUTHORIZED_BY_LOCKED_INTENT");
      }
      if (intent?.mode === "ACT" && check.visibility === "SECRET") {
        throw new Error("SECRET_CHECK_CANNOT_REPLACE_PLAYER_ACTION");
      }
    }

    const result = OutputSchema.parse(await context.lockAndResolveChecks(plan));
    if (result.planId !== plan.id || result.resolutions.some((item) => item.planId !== plan.id)) {
      throw new Error("RESOLUTION_PLAN_ID_MISMATCH");
    }
    return result;
  },
});
