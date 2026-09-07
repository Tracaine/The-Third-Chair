import { PlayerJournalSchema, type PlayerJournal } from "@third-chair/contracts";
import type { DatabaseSync } from "node:sqlite";
import type { CampaignId, JournalRecord, JournalRepository } from "./types.js";

interface JournalRow {
  campaign_id: string;
  state_version: number;
  audience: PlayerJournal["audience"];
  journal_json: string;
  journal_hash: string;
  created_at: string;
}

function parse(row: JournalRow): JournalRecord {
  return {
    campaignId: row.campaign_id,
    stateVersion: row.state_version,
    audience: row.audience,
    journal: PlayerJournalSchema.parse(JSON.parse(row.journal_json)),
    journalHash: row.journal_hash,
    createdAt: row.created_at,
  };
}

class SqliteJournalRepository implements JournalRepository {
  constructor(private readonly db: DatabaseSync) {}

  get(campaignId: CampaignId, stateVersion: number, audience: PlayerJournal["audience"]): JournalRecord {
    const row = this.db.prepare(`SELECT * FROM journals
      WHERE campaign_id = ? AND state_version = ? AND audience = ?`).get(campaignId, stateVersion, audience) as JournalRow | undefined;
    if (!row) throw new Error("JOURNAL_NOT_FOUND");
    return parse(row);
  }

  listAtVersion(campaignId: CampaignId, stateVersion: number): readonly JournalRecord[] {
    const rows = this.db.prepare(`SELECT * FROM journals
      WHERE campaign_id = ? AND state_version = ? ORDER BY audience`).all(campaignId, stateVersion) as unknown as JournalRow[];
    return rows.map(parse);
  }
}

export function createJournalRepository(db: DatabaseSync): JournalRepository {
  return new SqliteJournalRepository(db);
}
