import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ActorIntentSchema,
  ResolutionPlanSchema,
  WorldStateSchema,
  type ResolutionPlan,
} from "@third-chair/contracts";
import {
  loadAgentConfig,
  OpenAiDirectorAdapter,
  SanitizedProviderError,
} from "@third-chair/agents";
import { resolvePlan } from "@third-chair/engine";
import { createSqliteSourcePackService, openSourcePackReadOnly } from "@third-chair/source-pack";

if (process.env.NODE_ENV !== "development" || process.env.THIRD_CHAIR_PRIVATE_DEV !== "1") {
  throw new Error("DIRECTOR_SMOKE_REQUIRES_PRIVATE_DEV");
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY_REQUIRED");

const state = WorldStateSchema.parse(JSON.parse(readFileSync(
  new URL("./fixtures/chair-003-state.json", import.meta.url), "utf8",
)));
const intent = ActorIntentSchema.parse({
  seat: "BILL",
  actorId: "test_actor_bill",
  mode: "ACT",
  declaredAction: "Open the plainly unlocked door and step through.",
  desiredOutcome: "Enter the next room.",
  approach: "Open it normally.",
  committedResourceIds: [],
  targetIds: [],
  contingency: "Stop if the situation changes.",
});
const sourceDb = openSourcePackReadOnly(resolve(
  process.env.THIRD_CHAIR_SOURCE_PACK_DATABASE ?? "private/source-pack.sqlite",
));

try {
  const config = loadAgentConfig(process.env);
  let lockedPlan: ResolutionPlan | null = null;
  let lockedResult: ReturnType<typeof resolvePlan> | null = null;
  const metrics: { requests: number; toolNames: readonly string[] } = { requests: 0, toolNames: [] };
  const director = new OpenAiDirectorAdapter({
    config,
    sourcePack: createSqliteSourcePackService(sourceDb),
    preserveProviderDiagnostics: true,
    onMetrics: (value) => {
      metrics.requests = value.usage.requests;
      metrics.toolNames = value.invokedToolNames;
    },
  });
  const started = performance.now();
  try {
    const proposal = await director.propose({
      turnId: "test_director_smoke_turn",
      state,
      intents: [intent],
      persistedPlan: null,
      persistedResolutions: [],
      runtime: {
        lockAndResolveChecks: (rawPlan) => {
          const plan = ResolutionPlanSchema.parse(rawPlan);
          const reused = lockedPlan !== null;
          if (lockedPlan !== null && JSON.stringify(plan) !== JSON.stringify(lockedPlan)) {
            throw new Error("DIRECTOR_SMOKE_PLAN_CHANGED");
          }
          if (lockedPlan === null) {
            lockedPlan = plan;
            lockedResult = resolvePlan(
              new Uint8Array(32).fill(7), state.metadata.campaignId, state.metadata.rngCounter, plan,
            );
          }
          return {
            planId: lockedPlan.id,
            resolutions: lockedResult!.resolutions,
            nextRngCounter: lockedResult!.nextRngCounter,
            reused,
          };
        },
      },
    });
    process.stdout.write(`${JSON.stringify({
      passed: true,
      code: "DIRECTOR_SMOKE_PASSED",
      model: config.directorModel,
      elapsedMs: Math.round(performance.now() - started),
      requests: metrics.requests,
      toolNames: metrics.toolNames,
      operationCount: proposal.uncontestedOperations.length + proposal.checkLinkedOperations.length,
    }, null, 2)}\n`);
  } catch (error) {
    const failure = error instanceof SanitizedProviderError
      ? { passed: false, code: error.message, ...error.diagnostic }
      : {
          passed: false,
          code: error instanceof Error && /^[A-Z][A-Z0-9_:.-]{2,100}$/.test(error.message)
            ? error.message : "DIRECTOR_SMOKE_FAILED",
          name: error instanceof Error ? error.name : "UnknownError",
        };
    process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  }
} finally {
  sourceDb.close();
}
