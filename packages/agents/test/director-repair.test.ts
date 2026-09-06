import { describe, expect, it } from "vitest";
import * as agents from "../src/index.js";
import type { AgentRunClient } from "../src/runner.js";
import { directorInput, proposal, sourcePack, usage } from "./director-fixtures.js";

describe("Director repair", () => {
  it("runs once from bounded diagnostics without duplicating hidden state into the repair prompt", async () => {
    const seen: string[] = [];
    const run: AgentRunClient["run"] = async (agent, input) => {
      seen.push(input);
      expect(agent.tools.map((tool) => tool.name)).toEqual([
        "search_rules_internal", "search_lore_internal", "search_timeline_internal",
        "get_entity_internal", "lock_and_resolve_checks",
      ]);
      return { finalOutput: proposal(), usage };
    };
    const adapter = new agents.OpenAiDirectorAdapter({
      config: agents.loadAgentConfig({}), sourcePack, runClient: { run },
    });
    const repaired = await adapter.repair({
      turnId: "test_turn", lockedPlanId: null, resolutions: [],
      invalidProposal: { uncontestedOperations: [{ kind: "MOVE_ACTOR" }] },
      issues: [{ path: "/uncontestedOperations/0/locationId", message: "UNKNOWN_LOCATION" }],
    }, directorInput());
    expect(repaired).toEqual(proposal());
    expect(seen).toHaveLength(1);
    expect(Object.keys(JSON.parse(seen[0]!)).sort()).toEqual([
      "invalidProposal", "issues", "lockedIntents", "lockedPlanId", "resolutions", "turnId",
    ]);
    expect(JSON.parse(seen[0]!).lockedIntents).toEqual(directorInput().intents);
    expect(seen[0]).not.toContain("currentDecision");
    expect(seen[0]).not.toContain("sourcePack");
  });
});
