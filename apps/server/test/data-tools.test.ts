import { describe, expect, it, vi } from "vitest";
import { minimumWorldState } from "@third-chair/contracts/test/fixtures";
import type { SourcePackService } from "@third-chair/contracts";
import { sha256Json } from "@third-chair/engine";
import { createCampaignRepository } from "@third-chair/storage";
import { createTempDatabase } from "@third-chair/storage/test/fixtures";
import {
  answerRules,
  getTableView,
  listCampaigns,
  recallKnownLore,
} from "@third-chair/server";

function seed() {
  const temp = createTempDatabase();
  const campaigns = createCampaignRepository(temp.db);
  const state = structuredClone(minimumWorldState);
  state.table.houseRules.push({ id: "test_house_rule_flanking", title: "Flanking", text: "Flanking grants advantage.", acceptedAtTurn: 0 });
  state.factions.test_faction_harpers = {
    id: "test_faction_harpers", audience: "PARTY", name: "Harpers", status: "Known", facts: [],
  };
  campaigns.createCampaign({
    id: state.metadata.campaignId,
    ownerId: "test_owner",
    name: "Lanterns",
    sourcePackHash: "fixture",
    rngSeed: new Uint8Array(32),
    currentState: state,
    currentStateHash: sha256Json(state),
    rootBranchId: "test_branch",
    rootBranchLabel: "Main",
    createdAt: "2026-08-27T12:00:00.000Z",
  });
  return { temp, campaigns, state };
}

function sourcePack(): SourcePackService {
  return {
    searchRules: vi.fn(() => [{
      kind: "RULE" as const, id: "rule_advantage", passage: "Advantage means roll two d20s and use the higher roll.",
      citation: { documentId: "srd-5.1", title: "SRD 5.1", pageStart: 5, pageEnd: 5, headingPath: ["Advantage"], edition: "SRD_5_1" },
      confidenceStatus: "NATIVE_TEXT" as const,
    }]),
    searchLore: vi.fn(() => [{
      kind: "LORE" as const, id: "lore_harpers", passage: "The Harpers oppose tyranny.",
      citation: { documentId: "frcs-3e", title: "FRCS", pageStart: 90, pageEnd: 90, headingPath: ["Harpers"], edition: "FRCS_3E_LORE_ONLY" },
      confidenceStatus: "HIGH_CONFIDENCE" as const,
    }]),
    searchTimeline: vi.fn(() => []),
    getEntity: vi.fn(() => null),
    manifest: vi.fn(() => ({ sourcePackManifestHash: "fixture" })),
  };
}

describe("CHAIR-004 data tools", () => {
  it("lists campaign summaries and computes audience-bound player view IDs", () => {
    const { temp, campaigns, state } = seed();
    try {
      const listed = listCampaigns({ campaigns }, { audience: "BILL" });
      expect(listed.structuredContent.campaigns).toEqual([expect.objectContaining({
        id: state.metadata.campaignId,
        name: "Lanterns",
        stateVersion: 0,
        decisionOwner: "BOTH",
        decisionMode: "EXPLORATION",
        status: "ACTIVE",
      })]);

      const bill = getTableView({ campaigns }, { campaignId: state.metadata.campaignId, audience: "BILL" });
      const raven = getTableView({ campaigns }, { campaignId: state.metadata.campaignId, audience: "RAVEN" });
      expect(bill.structuredContent.playerViewId).toMatch(/^[a-f0-9]{64}$/);
      expect(bill.structuredContent.playerViewId).not.toBe(raven.structuredContent.playerViewId);
      expect(bill.structuredContent.view).toMatchObject({ campaignId: state.metadata.campaignId, stateVersion: 0 });
    } finally { temp.close(); temp.cleanup(); }
  });

  it("answers only from SRD results and labels accepted house-rule overlays", () => {
    const { temp, campaigns, state } = seed();
    try {
      const result = answerRules({ campaigns, sourcePack: sourcePack() }, {
        campaignId: state.metadata.campaignId,
        question: "How does advantage work with flanking?",
        actorId: "test_actor_bill",
      });
      expect(result.structuredContent).toMatchObject({
        ruling: expect.stringContaining("roll two d20s"),
        citations: [expect.objectContaining({ documentId: "srd-5.1", pageStart: 5 })],
        houseRules: [{ id: "test_house_rule_flanking", title: "Flanking", text: "Flanking grants advantage.", acceptedAtTurn: 0 }],
      });
    } finally { temp.close(); temp.cleanup(); }
  });

  it("restricts lore retrieval to entity IDs visible to the selected actor", () => {
    const { temp, campaigns, state } = seed();
    const sources = sourcePack();
    try {
      const result = recallKnownLore({ campaigns, sourcePack: sources }, {
        campaignId: state.metadata.campaignId,
        actorId: "test_actor_bill",
        question: "What do I know about the Harpers?",
      });
      expect(sources.searchLore).toHaveBeenCalledWith(expect.objectContaining({
        query: "What do I know about the Harpers?",
        entityIds: expect.arrayContaining(["test_faction_harpers"]),
      }));
      expect(result.structuredContent.results).toEqual([
        expect.objectContaining({ id: "lore_harpers", passage: "The Harpers oppose tyranny." }),
      ]);
    } finally { temp.close(); temp.cleanup(); }
  });

  it("refuses unrestricted lore search when the actor has no established knowledge IDs", () => {
    const { temp, campaigns, state } = seed();
    const sources = sourcePack();
    try {
      state.factions = {};
      const emptyCampaigns = {
        ...campaigns,
        getCampaign: () => ({ ...campaigns.getCampaign(state.metadata.campaignId), currentState: state }),
      };
      const result = recallKnownLore({ campaigns: emptyCampaigns, sourcePack: sources }, {
        campaignId: state.metadata.campaignId,
        actorId: "test_actor_bill",
        question: "Tell me every secret in Faerun.",
      });
      expect(sources.searchLore).not.toHaveBeenCalled();
      expect(result.structuredContent.results).toEqual([]);
    } finally { temp.close(); temp.cleanup(); }
  });
});
