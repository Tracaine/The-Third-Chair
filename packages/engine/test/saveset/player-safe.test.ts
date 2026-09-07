import { describe, expect, it } from "vitest";
import { extractSaveSetZip, exportSaveSet } from "@third-chair/engine";
import { createCampaignArchiveRepository, hashStoredState } from "@third-chair/storage";
import { createTempDatabase, seedCampaign } from "@third-chair/storage/test/fixtures";
import { createRewindLineage, HIDDEN_SENTINEL, installRichState } from "./fixtures.js";

const decoder = new TextDecoder();

describe("PLAYER_SAFE SaveSet export", () => {
  it("uses Bill/journal projections and excludes private truth, RNG, and turn ledgers", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "saveset_player_safe");
      installRichState(temp.db, "saveset_player_safe");
      const exported = exportSaveSet({
        repository: createCampaignArchiveRepository(temp.db),
        campaignId: seeded.campaignId,
        expectedStateVersion: 0,
        mode: "PLAYER_SAFE",
        createdAt: "2026-09-07T13:00:00.000Z",
      });
      const members = extractSaveSetZip({ mode: "PLAYER_SAFE", archive: exported.archive });
      const archiveText = Object.values(members).map((bytes) => decoder.decode(bytes)).join("\n");

      expect(Object.keys(members).sort()).toEqual([
        "branches.json", "characters.json", "citations.json", "journal.md", "manifest.json",
        "player-view.json", "rulings.json", "visible-turn-summaries.json",
      ]);
      expect(archiveText).not.toContain(HIDDEN_SENTINEL);
      expect(archiveText).not.toContain("RAVEN_ONLY_SENTINEL");
      expect(archiveText).not.toContain("rngSeed");
      expect(archiveText).not.toContain("rngCounter");
      expect(archiveText).not.toContain("beforeState");
      expect(archiveText).not.toContain("current_state_json");
      expect(archiveText).not.toContain("Hidden Doom");
      expect(JSON.parse(decoder.decode(members["citations.json"]))).toEqual([
        "srd:class:fighter",
        "srd:rule:travel",
      ]);
      expect(JSON.parse(decoder.decode(members["rulings.json"]))).toEqual([
        { id: "test_ruling_flanking", title: "Flanking", text: "Flanking grants advantage.", acceptedAtTurn: 0 },
      ]);
    } finally {
      temp.close();
      temp.cleanup();
    }
  });

  it("refuses to archive a campaign whose current state hash is not canonical", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "saveset_bad_state_hash");
      installRichState(temp.db, "saveset_bad_state_hash");
      temp.db.prepare("UPDATE campaigns SET current_state_hash=? WHERE id=?")
        .run("b".repeat(64), seeded.campaignId);
      expect(() => exportSaveSet({
        repository: createCampaignArchiveRepository(temp.db), campaignId: seeded.campaignId,
        expectedStateVersion: 0, mode: "PLAYER_SAFE",
      })).toThrow("SAVESET_STATE_HASH_MISMATCH");
    } finally {
      temp.close(); temp.cleanup();
    }
  });

  it("carries forward visible summaries when rewind advances beyond the latest journal row", () => {
    const temp = createTempDatabase();
    try {
      const seeded = seedCampaign(temp.db, "saveset_after_rewind");
      installRichState(temp.db, "saveset_after_rewind");
      const row = temp.db.prepare("SELECT journal_json FROM journals WHERE campaign_id=? AND audience='BILL'")
        .get(seeded.campaignId) as { journal_json: string };
      const journal = JSON.parse(row.journal_json);
      journal.recentTurns = [{ turnId: "test_turn_visible_before_rewind", stateVersion: 0,
        narrationExcerpt: "A visible moment before the rewind.", visibleResolutionIds: [] }];
      temp.db.prepare("UPDATE journals SET journal_json=?,journal_hash=? WHERE campaign_id=? AND audience='BILL'")
        .run(JSON.stringify(journal), hashStoredState(journal), seeded.campaignId);
      createRewindLineage(temp.db, "saveset_after_rewind");

      const exported = exportSaveSet({ repository: createCampaignArchiveRepository(temp.db),
        campaignId: seeded.campaignId, expectedStateVersion: 1, mode: "PLAYER_SAFE" });
      const members = extractSaveSetZip({ mode: "PLAYER_SAFE", archive: exported.archive });
      expect(JSON.parse(decoder.decode(members["visible-turn-summaries.json"]))).toEqual(journal.recentTurns);
    } finally {
      temp.close(); temp.cleanup();
    }
  });
});
