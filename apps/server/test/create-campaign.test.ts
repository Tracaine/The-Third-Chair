import { describe, expect, it } from "vitest";
import { computePlayerViewId, createCampaign, createCampaignDescriptor, createMcpServer } from "@third-chair/server";

describe("create_campaign MCP boundary", () => {
  it("advertises an idempotent closed-world mutation and returns only the player-safe opening", async () => {
    expect(createCampaignDescriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true });
    const input = { requestId: "test_request_mcp", ownerId: "Bill", campaignName: "Bridge", sourcePackHash: "a".repeat(64), setting: { region: "Dalelands", startDateDr: 1375 }, billCharacter: undefined, ravenCharacter: undefined };
    const baseCard = { pronouns: "they/them", level: 1 as const, ancestrySourceKey: "ancestry", classSourceKey: "class", backgroundSourceKey: "background", abilities: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 }, proficiencyBonus: 2, armorClass: 14, maxHp: 10, speed: 30 };
    const safe = { campaignId: "test_campaign_mcp", sourcePackHash: "a".repeat(64), visibleOpening: "A caravan is detained at the bridge.", characters: [
      { ...baseCard, actorId: "test_actor_bill", controller: "BILL" as const, name: "Alden" },
      { ...baseCard, actorId: "test_actor_raven", controller: "RAVEN" as const, name: "Vesper" },
    ], currentDecision: { id: "test_decision_mcp", stateVersion: 0, mode: "EXPLORATION", owner: "BOTH", situation: "A caravan is detained at the bridge.", eligibleActorIds: ["test_actor_bill", "test_actor_raven"], constraints: "Choose independently.", requiredInput: "Bill and Raven each declare an action.", legalOptions: [] }, stateHash: "f".repeat(64) };
    const result = await createCampaign({
      campaignCreator: { create: async () => safe } as never,
      sourcePack: { manifest: () => ({ sourcePackManifestHash: "a".repeat(64) }) } as never,
      ownerId: "Bill",
    }, input);
    expect(result.structuredContent).toMatchObject({ campaignId: "test_campaign_mcp", visibleOpening: safe.visibleOpening });
    expect(result.structuredContent.playerViewId).toBe(computePlayerViewId(safe.campaignId, 0, "RAVEN", safe.stateHash));
    expect(JSON.stringify(result)).not.toMatch(/centralTruth|rngSeed|spine|DIRECTOR/);
  });

  it("registers create_campaign in the in-process MCP server", () => {
    const server = createMcpServer({ campaigns: {} as never, turns: {} as never, engine: {} as never, campaignCreator: {} as never });
    expect(server.tools.map((tool) => tool.name)).toContain("create_campaign");
  });
});
