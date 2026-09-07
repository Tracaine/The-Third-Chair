import { describe, expect, it } from "vitest";
import { buildPartyJournal, buildPlayerJournal, projectPlayerView } from "@third-chair/engine";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";

describe("journal spoiler sentinel", () => {
  it("excludes Director truth and Raven-only memories from Bill and Party journals", () => {
    const state = structuredClone(minimumWorldState);
    state.facts.push(
      { id: "test_truth_director", audience: "DIRECTOR", kind: "Truth", text: "DIRECTOR_SECRET_SENTINEL" },
      { id: "test_memory_raven", audience: "RAVEN", kind: "Memory", text: "RAVEN_ONLY_SENTINEL" },
    );
    state.clocks.test_hidden_clock = {
      id: "test_hidden_clock", audience: "DIRECTOR", name: "HIDDEN_SENTINEL", status: "Ticking",
      current: 1, maximum: 6, facts: [],
    };
    state.npcs.test_npc_common = {
      id: "test_npc_common", audience: "PARTY", name: "Known Guide", status: "Friendly",
      facts: [
        { id: "test_npc_public_fact", audience: "PARTY", kind: "Known", text: "Travels the north road." },
        { id: "test_npc_bill_fact", audience: "BILL", kind: "Confidence", text: "BILL_ONLY_NESTED_SENTINEL" },
      ],
    };

    const billView = projectPlayerView(state, "BILL");
    const ravenView = projectPlayerView(state, "RAVEN");
    const bill = buildPlayerJournal(billView, []);
    const party = buildPartyJournal(billView, ravenView, []);

    expect(JSON.stringify(bill)).not.toMatch(/DIRECTOR_SECRET_SENTINEL|RAVEN_ONLY_SENTINEL|HIDDEN_SENTINEL/);
    expect(JSON.stringify(party)).not.toMatch(/DIRECTOR_SECRET_SENTINEL|RAVEN_ONLY_SENTINEL|HIDDEN_SENTINEL|BILL_ONLY_NESTED_SENTINEL/);
  });

  it("rejects a forbidden sentinel even when it reaches a visible field", () => {
    const state = structuredClone(minimumWorldState);
    state.facts.push({ id: "test_bad_public", audience: "PARTY", kind: "Clue", text: "DIRECTOR_SECRET_SENTINEL" });
    expect(() => buildPlayerJournal(projectPlayerView(state, "BILL"), [])).toThrow(/Forbidden sentinel/);
  });
});
