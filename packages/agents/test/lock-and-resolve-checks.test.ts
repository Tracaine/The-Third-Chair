import { RunContext } from "@openai/agents";
import type { CheckResolution, ResolutionPlan, SourcePackService } from "@third-chair/contracts";
import { describe, expect, it, vi } from "vitest";
import * as agents from "../src/index.js";
import type { DirectorRunContext } from "../src/tools/context.js";

const plan: ResolutionPlan = {
  id: "test_plan_locked",
  checks: [{
    id: "test_check_locked", actorId: "test_actor_bill", checkKind: "Ability Check",
    key: "strength", sides: 20, advantage: "NORMAL", advantageReason: "No advantage.",
    modifier: 2, dc: 10, visibility: "PUBLIC", successStakes: "The door opens.",
    failureStakes: "The door remains shut.",
    permittedOutcomeTiers: ["CRITICAL_FAILURE", "FAILURE", "SUCCESS", "CRITICAL_SUCCESS"], citations: [],
  }],
};

const resolution: CheckResolution = {
  id: "test_check_locked", planId: "test_plan_locked", actorId: "test_actor_bill",
  checkKind: "Ability Check", key: "strength", naturalDice: [12], keptDie: 12,
  modifier: 2, total: 14, target: 10, tier: "SUCCESS", visibility: "PUBLIC",
  advantage: "NORMAL", advantageReason: "No advantage.", successStakes: "The door opens.",
  failureStakes: "The door remains shut.", citations: [], startingCounter: 0, endingCounter: 1,
};

const sourcePack: SourcePackService = {
  searchRules: () => [], searchLore: () => [], searchTimeline: () => [], getEntity: () => null,
  manifest: () => ({ sourcePackManifestHash: "test-source-pack" }),
};

function makeContext(overrides: Partial<DirectorRunContext> = {}) {
  const lockAndResolveChecks = vi.fn(() => ({
    planId: plan.id, resolutions: [resolution], nextRngCounter: 1, reused: false,
  }));
  const context: DirectorRunContext = {
    turnId: "test_turn", campaignId: "test_campaign", sourcePack, intentsLocked: true,
    lockedIntents: [{ seat: "BILL", actorId: "test_actor_bill", mode: "ACT",
      declaredAction: "Open the door", desiredOutcome: "Enter", approach: "Force it",
      committedResourceIds: [], targetIds: [], contingency: "Step back" }],
    abortSignal: new AbortController().signal, lockAndResolveChecks, ...overrides,
  };
  return { context, runContext: new RunContext(context), lockAndResolveChecks };
}

function directorTools() {
  expect(agents).toHaveProperty("createDirectorTools", expect.any(Function));
  return (agents as typeof agents & { createDirectorTools(): ReturnType<typeof agents.createRetrievalTools> }).createDirectorTools();
}

describe("lock_and_resolve_checks", () => {
  it("is the Director's fifth strict local tool and returns only persisted resolution metadata", async () => {
    const tools = directorTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "search_rules_internal", "search_lore_internal", "search_timeline_internal",
      "get_entity_internal", "lock_and_resolve_checks",
    ]);
    const tool = tools[4]!;
    expect(tool).toMatchObject({ type: "function", strict: true, timeoutMs: 5_000,
      timeoutBehavior: "raise_exception", errorFunction: null });
    expect(tool.parameters).toMatchObject({ type: "object", additionalProperties: false });
    expect(tool.outputSchema).toMatchObject({ type: "object", additionalProperties: false,
      required: ["planId", "resolutions", "nextRngCounter", "reused"] });

    const { runContext, lockAndResolveChecks } = makeContext();
    await expect(tool.invoke(runContext, JSON.stringify(plan))).resolves.toEqual({
      planId: "test_plan_locked", resolutions: [resolution], nextRngCounter: 1, reused: false,
    });
    expect(lockAndResolveChecks).toHaveBeenCalledOnce();
    expect(lockAndResolveChecks).toHaveBeenCalledWith(plan);
  });

  it("rejects an unlocked or secret player check before the engine callback", async () => {
    const tool = directorTools()[4]!;
    const unlocked = makeContext({ intentsLocked: false });
    await expect(tool.invoke(unlocked.runContext, JSON.stringify(plan))).rejects.toThrow("INTENTS_NOT_LOCKED");
    expect(unlocked.lockAndResolveChecks).not.toHaveBeenCalled();

    const secret = makeContext();
    await expect(tool.invoke(secret.runContext, JSON.stringify({
      ...plan, checks: [{ ...plan.checks[0], visibility: "SECRET" }],
    }))).rejects.toThrow("SECRET_CHECK_CANNOT_REPLACE_PLAYER_ACTION");
    expect(secret.lockAndResolveChecks).not.toHaveBeenCalled();
  });
});
