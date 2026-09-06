import { describe, expect, it } from "vitest";
import { createCampaignRepository, createCampaignCreationRepository } from "@third-chair/storage";
import { buildLevelOneCharacter, createCampaignBuilder, projectPlayerView } from "@third-chair/engine";
import { createTempDatabase } from "@third-chair/storage/test/fixtures";
import { billDraft, catalog, ravenDraft } from "./fixtures.js";

const generated = (text: string, audience: "PUBLIC" | "PARTY" | "DIRECTOR" = "DIRECTOR") => ({ text, audience, origin: "CAMPAIGN_GENERATED" as const, citationIds: [] });
const spine = {
  setting: { region: "Dalelands" as const, startDateDr: 1375 as const },
  opening: { locationKey: "bridge", locationName: "Blackfeather Bridge", location: { ...generated("A Dalelands bridge.", "PUBLIC"), origin: "AUTHORED_SETTING" as const, citationIds: ["lore-1"] }, pressure: generated("A caravan faces seizure.", "PARTY") },
  centralTruth: generated("The order is forged."),
  routes: [
    { key: "social", method: "SOCIAL_LEVERAGE" as const, premise: generated("Sway the deputy."), startingClueKeys: ["seal"] },
    { key: "investigate", method: "INVESTIGATION_DISCOVERY" as const, premise: generated("Trace the ink."), startingClueKeys: ["ink"] },
    { key: "travel", method: "FACTION_OR_TRAVEL" as const, premise: generated("Follow the wagons."), startingClueKeys: ["tracks"] },
  ],
  factions: [{ key: "watch", name: "Bridge Watch", goal: generated("Hold the bridge."), clock: { key: "seizure", name: "Seizure", audience: "DIRECTOR" as const, origin: "CAMPAIGN_GENERATED" as const, citationIds: [], current: 0 as const, segments: 6 as const } }],
  npcs: [{ key: "deputy", name: "Deputy Orla", audience: "DIRECTOR" as const, origin: "CAMPAIGN_GENERATED" as const, citationIds: [], intention: "Protect her family.", relationships: ["Serves the reeve."], contradiction: "Doubts the order." }],
  outcomes: [{ key: "free", ...generated("The caravan is freed.") }, { key: "lost", ...generated("The route is lost.") }],
  startingClues: [{ key: "seal", ...generated("The seal is doubled.", "PARTY") }, { key: "ink", ...generated("The ink is tacky.", "PARTY") }, { key: "tracks", ...generated("Tracks leave the road.", "PARTY") }],
  riskTags: [{ key: "law", ...generated("Confiscation is imminent.") }],
  citations: [{ id: "lore-1", documentId: "frcs", title: "Campaign Setting", pageStart: 1, pageEnd: 1, headingPath: ["Dalelands"], edition: "FRCS_3E_LORE_ONLY" }],
};

function request() {
  return { requestId: "test_request_create", ownerId: "Bill", campaignName: "The Blackfeather Ledger", tone: "grounded intrigue", boundaries: ["No harm to children"], sourcePackHash: "a".repeat(64), setting: { region: "Dalelands" as const, startDateDr: 1375 as const }, billCharacter: billDraft, ravenCharacter: ravenDraft };
}

describe("campaign builder", () => {
  it("atomically creates a sourced party and returns the same campaign for an identical request", async () => {
    const temp = createTempDatabase();
    try {
      let calls = 0;
      const creator = createCampaignBuilder({ campaigns: createCampaignRepository(temp.db), creationRequests: createCampaignCreationRepository(temp.db), sourcePack: { manifest: () => ({ sourcePackManifestHash: "a".repeat(64) }) } as never, loadCharacterCatalog: () => catalog, spine: { generate: async () => { calls += 1; return spine; } }, ids: { campaign: () => "test_campaign_created", branch: () => "test_branch_created", location: () => "test_location_created", scene: () => "test_scene_created", decision: () => "test_decision_created", record: (kind, key) => `test_${kind}_${key}` }, rngSeed: () => new Uint8Array(32).fill(7), now: () => "2026-09-06T12:00:00.000Z" });
      const first = await creator.create(request());
      const second = await creator.create(request());
      expect(second.campaignId).toBe(first.campaignId);
      expect(calls).toBe(1);
      const campaign = createCampaignRepository(temp.db).getCampaign(first.campaignId);
      expect(Object.values(campaign.currentState.actors).map((actor) => actor.controller).sort()).toEqual(["BILL", "RAVEN"]);
      expect(campaign.currentDecision.owner).toBe("BOTH");
      expect(campaign.currentState.clocks["test_clock_seizure"]).toMatchObject({ audience: "DIRECTOR", current: 0, maximum: 6 });
      const playerView = projectPlayerView(campaign.currentState, "RAVEN");
      expect(playerView.facts.filter((fact) => fact.kind === "Clue")).toHaveLength(3);
      expect(JSON.stringify(playerView)).not.toMatch(/The order is forged|The caravan is freed|Seizure/);
      expect(first).not.toHaveProperty("spine");
      expect(JSON.stringify(first)).not.toContain("The order is forged");
    } finally { temp.close(); temp.cleanup(); }
  });

  it("validates source binding and both player seats before model work", async () => {
    const temp = createTempDatabase();
    try {
      let calls = 0;
      const creator = createCampaignBuilder({ campaigns: createCampaignRepository(temp.db), creationRequests: createCampaignCreationRepository(temp.db), sourcePack: { manifest: () => ({ sourcePackManifestHash: "b".repeat(64) }) } as never, loadCharacterCatalog: () => catalog, spine: { generate: async () => { calls += 1; return spine; } } });
      await expect(creator.create(request())).rejects.toThrow("SOURCE_PACK_HASH_MISMATCH");
      await expect(creator.create({ ...request(), requestId: "test_request_missing", sourcePackHash: "b".repeat(64), ravenCharacter: undefined })).rejects.toThrow("AWAITING_RAVEN_CHARACTER");
      await expect(creator.create({ ...request(), requestId: "test_request_wrong_seat", sourcePackHash: "b".repeat(64), ravenCharacter: { ...ravenDraft, controller: "BILL" } })).rejects.toThrow("CHARACTER_SEAT_MISMATCH");
      expect(calls).toBe(0);
      expect(createCampaignRepository(temp.db).listCampaigns()).toEqual([]);
    } finally { temp.close(); temp.cleanup(); }
  });

  it("leaves no partial campaign when spine generation fails", async () => {
    const temp = createTempDatabase();
    try {
      const creator = createCampaignBuilder({ campaigns: createCampaignRepository(temp.db), creationRequests: createCampaignCreationRepository(temp.db), sourcePack: { manifest: () => ({ sourcePackManifestHash: "a".repeat(64) }) } as never, loadCharacterCatalog: () => catalog, spine: { generate: async () => { throw new Error("SPINE_FAILED"); } } });
      await expect(creator.create(request())).rejects.toThrow("SPINE_FAILED");
      expect(createCampaignRepository(temp.db).listCampaigns()).toEqual([]);
      expect(createCampaignCreationRepository(temp.db).get("test_request_create").status).toBe("FAILED");
    } finally { temp.close(); temp.cleanup(); }
  });

  it("maps every deterministic character field into runtime ActorState", () => {
    const bill = buildLevelOneCharacter(billDraft, "BILL", catalog);
    expect(bill.maxHp).toBeGreaterThan(0);
  });
});
