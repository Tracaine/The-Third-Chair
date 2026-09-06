import { describe, expect, it } from "vitest";
import { CampaignSpineProposalSchema } from "@third-chair/contracts";
import { createCampaignSpineAgent, loadAgentConfig, OpenAiCampaignSpineAdapter } from "../src/index.js";
import type { AgentRunClient } from "../src/runner.js";

const record = (text: string, audience: "PUBLIC" | "PARTY" | "DIRECTOR" = "DIRECTOR") => ({
  text, audience, origin: "CAMPAIGN_GENERATED" as const, citationIds: [],
});

function validSpine() {
  return {
    setting: { region: "Dalelands", startDateDr: 1375 },
    opening: {
      locationKey: "blackfeather_bridge", locationName: "Blackfeather Bridge",
      location: { ...record("A bridge in the Dalelands.", "PUBLIC"), origin: "AUTHORED_SETTING" as const, citationIds: ["lore-dalelands-1"] },
      pressure: record("A detained caravan will be seized at sundown.", "PARTY"),
    },
    centralTruth: record("The seizure order was forged to conceal a smuggling route."),
    routes: [
      { key: "win_the_reeve", method: "SOCIAL_LEVERAGE", premise: record("Turn the reeve's deputy against the order."), startingClueKeys: ["clue_seal"] },
      { key: "trace_the_ink", method: "INVESTIGATION_DISCOVERY", premise: record("Trace the forged ink to its buyer."), startingClueKeys: ["clue_ink"] },
      { key: "follow_the_wagons", method: "FACTION_OR_TRAVEL", premise: record("Follow the diverted wagons into the woods."), startingClueKeys: ["clue_tracks"] },
    ],
    factions: [{ key: "bridge_watch", name: "Bridge Watch", goal: record("Keep control of the crossing."), clock: { key: "seizure", name: "Caravan Seized", audience: "DIRECTOR", origin: "CAMPAIGN_GENERATED", citationIds: [], current: 0, segments: 6 } }],
    npcs: [{ key: "deputy", name: "Deputy Orla", audience: "DIRECTOR", origin: "CAMPAIGN_GENERATED", citationIds: [], intention: "Protect her family from the smugglers.", relationships: ["Owes the reeve her office."], contradiction: "Enforces an order she suspects is forged." }],
    outcomes: [{ key: "caravan_freed", ...record("The caravan is freed and the forgery exposed.") }, { key: "route_entrenched", ...record("The smugglers secure the crossing.") }],
    startingClues: [
      { key: "clue_seal", ...record("The seal impression is slightly doubled.", "PARTY") },
      { key: "clue_ink", ...record("The ink is still tacky.", "PARTY") },
      { key: "clue_tracks", ...record("Fresh wagon tracks leave the official road.", "PARTY") },
    ],
    riskTags: [{ key: "law", ...record("Local law can confiscate the caravan.") }],
    citations: [{ id: "lore-dalelands-1", documentId: "frcs", title: "Campaign Setting", pageStart: 120, pageEnd: 120, headingPath: ["Dalelands"], edition: "FRCS_3E_LORE_ONLY" }],
  };
}

describe("campaign spine contract", () => {
  it("accepts exactly three materially distinct route methods and at least two outcomes", () => {
    expect(CampaignSpineProposalSchema.parse(validSpine()).routes.map((route) => route.method).sort()).toEqual([
      "FACTION_OR_TRAVEL", "INVESTIGATION_DISCOVERY", "SOCIAL_LEVERAGE",
    ]);
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), routes: validSpine().routes.slice(0, 2) })).toThrow();
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), routes: [...validSpine().routes, validSpine().routes[0]] })).toThrow();
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), routes: validSpine().routes.map((route) => ({ ...route, method: "SOCIAL_LEVERAGE" })) })).toThrow();
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), outcomes: validSpine().outcomes.slice(0, 1) })).toThrow();
  });

  it("rejects unsupported dates, uncited authored claims, and unlabeled inventions", () => {
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), setting: { region: "Dalelands", startDateDr: 1492 } })).toThrow();
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), opening: { ...validSpine().opening, location: { ...validSpine().opening.location, citationIds: [] } } })).toThrow();
    const { origin: _origin, ...unlabeled } = validSpine().centralTruth;
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), centralTruth: unlabeled })).toThrow();
  });

  it("keeps the hidden spine Director-only while the opening and starting clues are player-visible", () => {
    const publicRoute = { ...validSpine().routes[0], premise: { ...validSpine().routes[0]!.premise, audience: "PARTY" } };
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), routes: [publicRoute, ...validSpine().routes.slice(1)] })).toThrow("HIDDEN_CAMPAIGN_RECORD_AUDIENCE_REQUIRED");
    expect(() => CampaignSpineProposalSchema.parse({ ...validSpine(), opening: { ...validSpine().opening, pressure: { ...validSpine().opening.pressure, audience: "DIRECTOR" } } })).toThrow("VISIBLE_OPENING_AUDIENCE_REQUIRED");
  });

  it("runs a fresh strict Director-profile agent without mutation tools or a session", async () => {
    const proposal = validSpine();
    const run: AgentRunClient["run"] = async (agent, serialized, options) => {
      expect(agent.name).toBe("Third Chair Campaign Spine");
      expect(agent.model).toBe("gpt-5.6-sol");
      expect(agent.modelSettings).toEqual({ reasoning: { effort: "high" }, text: { verbosity: "low" }, parallelToolCalls: false });
      expect(agent.outputType).toBe(CampaignSpineProposalSchema);
      expect(agent.tools.map((tool) => tool.name)).not.toContain("lock_and_resolve_checks");
      expect(options).not.toHaveProperty("session");
      expect(JSON.parse(serialized)).toMatchObject({ setting: { region: "Dalelands", startDateDr: 1375 } });
      return { finalOutput: proposal, usage: { requests: 1, inputTokens: 1, outputTokens: 1, totalTokens: 2 } };
    };
    const config = loadAgentConfig({});
    const adapter = new OpenAiCampaignSpineAdapter({ config, sourcePack: {} as never, runClient: { run }, tools: [] });
    const characters = [
      { controller: "BILL" as const, name: "Alden", classSourceKey: "guardian", ancestrySourceKey: "steadfast", backgroundSourceKey: "envoy", characterHook: "Keeps promises." },
      { controller: "RAVEN" as const, name: "Vesper", classSourceKey: "arcanist", ancestrySourceKey: "starling", backgroundSourceKey: "scholar", characterHook: "Collects dangerous questions." },
    ];
    await expect(adapter.generate({ requestId: "test_request_spine", campaignName: "Bridge", tone: "tense", boundaries: [], sourcePackHash: "a".repeat(64), setting: { region: "Dalelands", startDateDr: 1375 }, characters })).resolves.toEqual(proposal);
    expect(createCampaignSpineAgent(config, []).tools).toEqual([]);
  });
});
