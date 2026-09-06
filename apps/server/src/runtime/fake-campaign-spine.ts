import type { CampaignSpinePort } from "@third-chair/engine";

const generated = (text: string, audience: "PUBLIC" | "PARTY" | "DIRECTOR" = "DIRECTOR") => ({
  text, audience, origin: "CAMPAIGN_GENERATED" as const, citationIds: [],
});

export function createFakeCampaignSpine(): CampaignSpinePort {
  return { generate: async () => ({
    setting: { region: "Dalelands", startDateDr: 1375 },
    opening: { locationKey: "bridge", locationName: "Fixture Bridge",
      location: generated("A local deterministic fixture crossing.", "PUBLIC"),
      pressure: generated("A wagon blocks the crossing as dusk approaches.", "PARTY") },
    centralTruth: generated("The obstruction was arranged to test the travelers."),
    routes: [
      { key: "parley", method: "SOCIAL_LEVERAGE", premise: generated("Persuade the wagon master to move."), startingClueKeys: ["voices"] },
      { key: "inspect", method: "INVESTIGATION_DISCOVERY", premise: generated("Inspect the damaged axle."), startingClueKeys: ["axle"] },
      { key: "detour", method: "FACTION_OR_TRAVEL", premise: generated("Find another crossing."), startingClueKeys: ["path"] },
    ],
    factions: [{ key: "wagoners", name: "Fixture Wagoners", goal: generated("Keep the crossing closed."),
      clock: { key: "nightfall", name: "Nightfall", audience: "DIRECTOR", origin: "CAMPAIGN_GENERATED", citationIds: [], current: 0, segments: 6 } }],
    npcs: [{ key: "master", name: "Fixture Wagon Master", audience: "DIRECTOR", origin: "CAMPAIGN_GENERATED", citationIds: [],
      intention: "Complete the test.", relationships: ["Leads the wagoners."], contradiction: "Claims the blockage is accidental." }],
    outcomes: [{ key: "cross", ...generated("The party crosses before dark.") }, { key: "delay", ...generated("Night falls before the crossing opens.") }],
    startingClues: [{ key: "voices", ...generated("The wagoners are quietly rehearsing.", "PARTY") },
      { key: "axle", ...generated("The axle was deliberately loosened.", "PARTY") },
      { key: "path", ...generated("A footpath follows the riverbank.", "PARTY") }],
    riskTags: [{ key: "nightfall", ...generated("Darkness will complicate the crossing.") }],
    citations: [],
  }) };
}
