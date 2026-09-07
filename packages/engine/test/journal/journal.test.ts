import { describe, expect, it } from "vitest";
import { PlayerJournalSchema } from "@third-chair/contracts";
import { buildPlayerJournal, projectPlayerView, renderPlayerJournalMarkdown } from "@third-chair/engine";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";

describe("player journal derivation", () => {
  it("builds a stable, bounded journal from player-visible state", () => {
    const state = structuredClone(minimumWorldState);
    state.actors.test_actor_bill.experiencePoints = 125;
    state.table.houseRules.push({
      id: "test_ruling_flanking",
      title: "Flanking",
      text: "Flanking does not grant advantage.",
      acceptedAtTurn: 2,
    });
    state.quests.test_quest_bridge = {
      id: "test_quest_bridge",
      audience: "PARTY",
      name: "The Broken Bridge",
      status: "ACTIVE",
      facts: [{ id: "test_lead_bridge", audience: "PARTY", kind: "Lead", text: "Find the missing mason." }],
    };
    state.facts.push({ id: "test_clue_mud", audience: "BILL", kind: "Clue", text: "Red mud marks the courier's boots." });
    state.inventory.test_item_gold = {
      id: "test_item_gold",
      name: "Gold pieces",
      ownerActorId: "test_actor_bill",
      containerId: null,
      quantity: 17,
      equippedSlots: [],
      facts: [{ id: "test_currency_gold", audience: "BILL", kind: "Currency", text: "Gold coin" }],
    };
    const longNarration = "A".repeat(400);

    const journal = buildPlayerJournal(projectPlayerView(state, "BILL"), [
      { turnId: "test_turn_older", stateVersion: 1, narrationExcerpt: "An older visible turn.", visibleResolutionIds: [] },
      { turnId: "test_turn_newer", stateVersion: 2, narrationExcerpt: longNarration, visibleResolutionIds: ["test_resolution_public"] },
    ]);

    expect(PlayerJournalSchema.parse(journal)).toEqual(journal);
    expect(journal.audience).toBe("BILL");
    expect(journal.currentObjective?.id).toBe("test_quest_bridge");
    expect(journal.immediateRisk).toBe(state.currentDecision.constraints);
    expect(journal.knownClues.map(({ id }) => id)).toContain("test_clue_mud");
    expect(journal.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "test_item_gold", quantity: 17, currency: true }),
    ]));
    expect(journal.actorStatus.find(({ id }) => id === "test_actor_bill")).toEqual(
      expect.objectContaining({ experiencePoints: 125, currentHp: state.actors.test_actor_bill.currentHp }),
    );
    expect(journal.acceptedRulings.map(({ id }) => id)).toEqual(["test_ruling_flanking"]);
    expect(journal.recentTurns.map(({ turnId }) => turnId)).toEqual(["test_turn_newer", "test_turn_older"]);
    expect(journal.recentTurns[0]?.narrationExcerpt).toHaveLength(240);
    expect(renderPlayerJournalMarkdown(journal)).toContain("# Player Journal — Bill");
  });
});
