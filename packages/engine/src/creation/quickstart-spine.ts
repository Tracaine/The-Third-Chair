import { CampaignSpineProposalSchema, type CampaignSpineInput, type CampaignSpineProposal } from "@third-chair/contracts";

const generated = (text: string, audience: "PUBLIC" | "PARTY" | "DIRECTOR" = "DIRECTOR") => ({
  text, audience, origin: "CAMPAIGN_GENERATED" as const, citationIds: [],
});

/** An instant opening scaffold; the live Director develops it through committed play. */
export function createQuickstartCampaignSpine(input: CampaignSpineInput): CampaignSpineProposal {
  const [bill, raven] = input.characters;
  return CampaignSpineProposalSchema.parse({
    setting: input.setting,
    opening: {
      locationKey: "gloamroad_inn",
      locationName: "The Gloamroad Inn",
      location: generated("A weather-beaten inn stands where the forest road meets an old traders' crossing, its common room bright against a gathering storm.", "PUBLIC"),
      pressure: generated(`A wounded courier has collapsed across ${bill!.name} and ${raven!.name}'s table, clutching a brass key while armed riders rein in outside.`, "PARTY"),
    },
    centralTruth: generated("The courier stole proof that the riders' patron is buying condemned relics to wake what sleeps beneath the abandoned toll keep."),
    routes: [
      { key: "bargain_with_the_riders", method: "SOCIAL_LEVERAGE", premise: generated("Turn the riders against their patron by exposing which of them has been marked as expendable."), startingClueKeys: ["clue_split_wax"] },
      { key: "read_the_couriers_trail", method: "INVESTIGATION_DISCOVERY", premise: generated("Reconstruct the courier's route and decode what the brass key opens before the evidence is taken."), startingClueKeys: ["clue_bloodied_map"] },
      { key: "reach_the_toll_keep", method: "FACTION_OR_TRAVEL", premise: generated("Escape through the storm and reach the ruined toll keep ahead of the patron's retrieval party."), startingClueKeys: ["clue_black_thorn"] },
    ],
    factions: [{
      key: "gilt_spur_company", name: "The Gilt Spur Company", goal: generated("Recover the key and silence everyone who saw the courier."),
      clock: { key: "relic_awakens", name: "The Buried Relic Wakes", audience: "DIRECTOR", origin: "CAMPAIGN_GENERATED", citationIds: [], current: 0, segments: 6 },
    }],
    npcs: [{
      key: "courier_mara", name: "Mara Venn", audience: "DIRECTOR", origin: "CAMPAIGN_GENERATED", citationIds: [],
      intention: "Get the key into hands brave enough to use it.", relationships: ["Once kept accounts for the Gilt Spur Company."],
      contradiction: "She betrayed the Company, but still protects someone riding with them.",
    }],
    outcomes: [
      { key: "relic_sealed", ...generated("The relic remains sealed and the Company's patron is exposed.") },
      { key: "company_ascendant", ...generated("The Company claims the key and gains dangerous leverage over the crossing.") },
      { key: "dangerous_bargain", ...generated("The relic changes hands under a bargain whose price follows the heroes.") },
    ],
    startingClues: [
      { key: "clue_split_wax", ...generated("The courier's satchel bears two impressions from the same signet, one genuine and one clumsily recut.", "PARTY") },
      { key: "clue_bloodied_map", ...generated("A rain-blurred map in the courier's sleeve marks the abandoned toll keep in fresh blood.", "PARTY") },
      { key: "clue_black_thorn", ...generated("A black thorn caught in the courier's cloak grows only along the overgrown east road.", "PARTY") },
    ],
    riskTags: [
      { key: "armed_pursuit", ...generated("The riders use intimidation first and steel when cornered.") },
      { key: "awakening_relic", ...generated("Delay gives the buried relic time to influence dreams, animals, and the dead.") },
    ],
    citations: [],
  });
}
