import { describe, expect, it } from "vitest";
import type { QuickstartArchetype } from "@third-chair/contracts";
import { CampaignSpineInputSchema } from "@third-chair/contracts";
import { buildLevelOneCharacter, createQuickstartCampaignSpine, createStarterCharacterCatalog, quickstartCharacterDraft } from "@third-chair/engine";

describe("starter character catalog", () => {
  it.each<QuickstartArchetype>(["STALWART_FIGHTER", "CUNNING_ROGUE", "ARCANE_SCHOLAR", "DAWN_CLERIC"])(
    "builds a complete playable %s",
    (archetype) => {
      const draft = quickstartCharacterDraft({ name: "Raven", pronouns: "she/her", archetype, characterHook: "Trouble finds her first." }, "RAVEN");
      const character = buildLevelOneCharacter(draft, "RAVEN", createStarterCharacterCatalog());
      expect(character.maxHp).toBeGreaterThan(0);
      expect(character.armorClass).toBeGreaterThanOrEqual(10);
      expect(character.equipmentIds.length).toBeGreaterThan(0);
      expect(character.controller).toBe("RAVEN");
    },
  );

  it("creates an immediate valid three-route campaign opening", () => {
    const spine = createQuickstartCampaignSpine(CampaignSpineInputSchema.parse({
      requestId: "test_quickstart_spine", campaignName: "The Ashen Ledger", boundaries: [],
      sourcePackHash: "a".repeat(64), setting: { region: "Dalelands", startDateDr: 1375 },
      characters: [
        { controller: "BILL", name: "Alden", classSourceKey: "fighter", ancestrySourceKey: "human", backgroundSourceKey: "soldier", characterHook: "" },
        { controller: "RAVEN", name: "Vesper", classSourceKey: "rogue", ancestrySourceKey: "halfling", backgroundSourceKey: "criminal", characterHook: "" },
      ],
    }));
    expect(spine.routes.map((route) => route.method).sort()).toEqual(["FACTION_OR_TRAVEL", "INVESTIGATION_DISCOVERY", "SOCIAL_LEVERAGE"]);
    expect(spine.opening.pressure.audience).toBe("PARTY");
  });
});
