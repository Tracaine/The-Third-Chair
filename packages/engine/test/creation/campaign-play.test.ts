import { describe, expect, it, vi } from "vitest";
import { validateIntentsForDecision, type ActorIntent, type WorldOperation } from "@third-chair/contracts";
import {
  applyOperationsToClone, createCampaignBuilder, createQuickstartCampaignSpine, createTurnEngine,
  FakeDirector, FakeNarrator, projectPlayerView,
} from "@third-chair/engine";
import { createCampaignRepository, createCampaignCreationRepository, createTurnRepository } from "@third-chair/storage";
import { createTempDatabase } from "@third-chair/storage/test/fixtures";
import { billDraft, catalog, ravenDraft } from "./fixtures.js";

const sourcePackHash = "a".repeat(64);
const intent = (draft: typeof billDraft, declaredAction: string): ActorIntent => ({
  actorId: draft.actorId, seat: draft.controller, mode: "ACT", declaredAction,
  committedResourceIds: [], targetIds: [],
});

describe("campaign play", () => {
  it("narrates the opening once, discovers a clue during play and commits a chosen conclusion", async () => {
    const temp = createTempDatabase();
    try {
      const campaigns = createCampaignRepository(temp.db);
      const creationRequests = createCampaignCreationRepository(temp.db);
      const turns = createTurnRepository(temp.db);
      const narrateOpening = vi.fn((view) => {
        expect(view.audience).toBe("PARTY");
        expect(view.facts).toEqual([]);
        expect(view.actors.every((actor: { equipment?: unknown }) => actor.equipment === undefined)).toBe(true);
        return "A ferry rocks against the dock. A harbor bell sounds twice.";
      });
      const generate = vi.fn((input) => {
        const spine = createQuickstartCampaignSpine(input);
        return { ...spine, opening: { ...spine.opening, locationName: "The Broken Ferry" } };
      });
      const creator = createCampaignBuilder({ campaigns, creationRequests,
        sourcePack: { manifest: () => ({ sourcePackManifestHash: sourcePackHash }) },
        loadCharacterCatalog: () => catalog, spine: { generate: async (input) => generate(input) },
        narrator: { narrateOpening, narrate: () => { throw new Error("OPENING_ONLY"); } },
      });
      const request = { requestId: "test_ferry_creation", ownerId: "Bill", campaignName: "The Ferry",
        setting: { region: "Dalelands", startDateDr: 1375 }, creationMode: "QUICKSTART", sourcePackHash,
        billCharacter: billDraft, ravenCharacter: ravenDraft };
      const opening = await creator.create(request);
      expect(opening.visibleOpening).toContain("harbor bell");
      expect(opening.currentDecision.situation).toContain("The Broken Ferry");
      expect((await creator.create(request)).visibleOpening).toBe(opening.visibleOpening);
      expect(narrateOpening).toHaveBeenCalledTimes(1);
      expect(generate).toHaveBeenCalledTimes(1);

      const campaign = campaigns.getCampaign(opening.campaignId);
      const clue = campaign.currentState.facts.find((fact) => fact.kind === "Undiscovered Clue")!;
      const billIntent = intent(billDraft, "Inspect the seal");
      const ravenIntent = intent(ravenDraft, "Watch the door");
      const discovery: WorldOperation = { id: "test_discover_seal", kind: "DISCOVER_CLUE", clueId: clue.id,
        audience: "BILL", reason: "A close look reveals the recut signet.", cause: { type: "UNCONTESTED", intentActorId: billDraft.actorId } };
      const director = new FakeDirector(({ state }) => {
        const ending = state.metadata.turnNumber === 1;
        return { uncontestedOperations: ending ? [
          { id: "test_leave_ferry", kind: "SET_CAMPAIGN_PROGRESS", audience: "PARTY", reason: "Both players withdraw.",
            cause: { type: "UNCONTESTED", intentActorId: billDraft.actorId },
            progress: { phase: "ENDED", outcome: "ABANDONED", milestone: "The riders reclaim the crossing." } },
        ] : [discovery], checkLinkedOperations: [], riskTags: [], memoryWrites: [],
        nextDecision: ending ? { ...state.currentDecision, id: "test_ferry_closed", mode: "ENDED", owner: "DIRECTOR",
          eligibleActorIds: [], requiredInput: "", legalOptions: [], situation: "The riders reclaim the crossing." }
          : { ...state.currentDecision, id: "test_ferry_second", situation: "The riders guard the exit." },
        narrativeBrief: { summary: ending ? "The riders reclaim the crossing." : "The riders guard the exit.",
          requiredResolutionIds: [], requiredEventIds: [] } };
      });
      const narrator = new FakeNarrator(({ visibleState, proposal }) => {
        expect(JSON.stringify(visibleState)).not.toContain(clue.text);
        return { sceneText: proposal.narrativeBrief.summary, spokenNpcLines: [], mustIncludeResolutionIds: [],
          mustIncludeEventIds: [], visibleEventIds: [] };
      });
      const engine = createTurnEngine({ campaigns, turns, director, narrator });
      const first = { kind: "INTENTS" as const, campaignId: campaign.id, expectedStateVersion: 0,
        decisionId: opening.currentDecision.id, clientRequestId: "test_ferry_first", intents: [billIntent, ravenIntent] };
      expect((await engine.advanceGame(first)).kind).toBe("COMMITTED");
      const state = campaigns.getCampaign(campaign.id).currentState;
      expect(projectPlayerView(state, "BILL").facts).toContainEqual({ id: clue.id, kind: "Clue", text: clue.text });
      expect(projectPlayerView(state, "RAVEN").facts).toEqual([]);
      const second = { ...first, expectedStateVersion: 1, decisionId: state.currentDecision.id, clientRequestId: "test_ferry_second_request",
        intents: [intent(billDraft, "Leave the crossing"), intent(ravenDraft, "Withdraw along the road")] };
      expect((await engine.advanceGame(second)).view.campaignProgress).toMatchObject({ phase: "ENDED", outcome: "ABANDONED" });
      expect((await engine.advanceGame(second)).kind).toBe("COMMITTED");
      await expect(engine.advanceGame({ ...second, expectedStateVersion: 2, decisionId: "test_ferry_closed",
        clientRequestId: "test_after_ferry", intents: [] })).rejects.toThrow("CAMPAIGN_ENDED");
    } finally { temp.close(); temp.cleanup(); }
  });

  it("lets NPC damage kill either seat and excludes the dead actor from new intent", async () => {
    const temp = createTempDatabase();
    try {
      const campaigns = createCampaignRepository(temp.db);
      const creator = createCampaignBuilder({ campaigns, creationRequests: createCampaignCreationRepository(temp.db),
        sourcePack: { manifest: () => ({ sourcePackManifestHash: sourcePackHash }) },
        loadCharacterCatalog: () => catalog, spine: { generate: async (input) => createQuickstartCampaignSpine(input) } });
      const result = await creator.create({ requestId: "test_danger_creation", ownerId: "Bill", campaignName: "Danger",
        setting: { region: "Dalelands", startDateDr: 1375 }, sourcePackHash, billCharacter: billDraft, ravenCharacter: ravenDraft });
      const state = campaigns.getCampaign(result.campaignId).currentState;
      const npc = Object.values(state.npcs)[0]!;
      const hit = (draft: typeof billDraft) => applyOperationsToClone(state, [
        { id: "test_mortal_blow", kind: "SET_HP", audience: "PARTY", reason: "Massive damage", actorId: draft.actorId,
          value: -state.actors[draft.actorId]!.maxHp, cause: { type: "UNCONTESTED", intentActorId: npc.id } },
      ], { intents: [], resolutions: [] }).candidate;
      for (const draft of [billDraft, ravenDraft]) {
        const after = hit(draft);
        expect(after.actors[draft.actorId]).toMatchObject({ currentHp: 0, conditions: ["Dead"], deathSaves: { failures: 3 } });
        expect(() => validateIntentsForDecision(after.currentDecision,
          [intent(billDraft, "Act"), intent(ravenDraft, "Act")], after)).toThrow("CHARACTER_DEAD");
      }
    } finally { temp.close(); temp.cleanup(); }
  });
});
