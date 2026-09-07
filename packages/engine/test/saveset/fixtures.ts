import type { DatabaseSync } from "node:sqlite";
import { buildPartyJournal, buildPlayerJournal, projectPlayerView, renderPlayerJournalMarkdown } from "@third-chair/engine";
import { createCampaignRepository, createCheckpointRepository, createTurnRepository, hashStoredState } from "@third-chair/storage";
import { billIntent, checkResolution, committedCandidate, decision, resolutionPlan, turnProposal, worldState } from "@third-chair/storage/test/fixtures";

export const SOURCE_PACK_HASH = "a".repeat(64);
export const HIDDEN_SENTINEL = "DIRECTOR_SECRET_SENTINEL";

export function installRichState(db: DatabaseSync, suffix: string) {
  const state = structuredClone(worldState(suffix));
  state.npcs.test_npc_hidden = {
    id: "test_npc_hidden",
    audience: "DIRECTOR",
    name: "Hidden Schemer",
    status: "Secret",
    facts: [{ id: "test_fact_hidden", audience: "DIRECTOR", kind: "Goal", text: HIDDEN_SENTINEL }],
  };
  state.clocks.test_clock_hidden = {
    id: "test_clock_hidden",
    audience: "DIRECTOR",
    name: "Hidden Doom",
    status: "Unrevealed",
    current: 3,
    maximum: 6,
    facts: [],
  };
  state.actors.test_actor_bill!.sourceReferenceIds = ["srd:class:fighter"];
  state.locations.test_location!.facts.push({
    id: "test_source_visible",
    audience: "PARTY",
    kind: "Provenance",
    text: "AUTHORED_SETTING:srd:rule:travel",
  });
  state.actors.test_actor_bill!.scopedNotes.push({
    id: "test_note_raven_only",
    audience: "RAVEN",
    text: "RAVEN_ONLY_SENTINEL",
  });
  state.table.houseRules.push({
    id: "test_ruling_flanking",
    title: "Flanking",
    text: "Flanking grants advantage.",
    acceptedAtTurn: 0,
  });
  const stateHash = hashStoredState(state);
  db.prepare(`UPDATE campaigns SET source_pack_hash=?, current_state_json=?, current_state_hash=? WHERE id=?`)
    .run(SOURCE_PACK_HASH, JSON.stringify(state), stateHash, state.metadata.campaignId);

  const bill = buildPlayerJournal(projectPlayerView(state, "BILL"), []);
  const raven = buildPlayerJournal(projectPlayerView(state, "RAVEN"), []);
  const party = buildPartyJournal(projectPlayerView(state, "BILL"), projectPlayerView(state, "RAVEN"), []);
  for (const journal of [bill, raven, party]) {
    const journalJson = JSON.stringify(journal);
    const journalHash = hashStoredState(journal);
    db.prepare(`INSERT INTO journals(campaign_id,state_version,audience,journal_json,journal_hash,created_at)
      VALUES(?,?,?,?,?,?)`).run(state.metadata.campaignId, 0, journal.audience, journalJson, journalHash,
        "2026-09-07T12:05:00.000Z");
  }

  db.prepare(`INSERT INTO campaign_creation_requests(
    request_id,owner_id,input_hash,status,campaign_id,error_json,created_at,updated_at
  ) VALUES(?,?,?,'COMMITTED',?,NULL,?,?)`).run(
    `test_creation_${suffix}`, "test_owner", `creation-hash-${suffix}`, state.metadata.campaignId,
    "2026-09-07T12:00:00.000Z", "2026-09-07T12:00:00.000Z",
  );
  return { state, stateHash, bill, raven, party, journalMarkdown: renderPlayerJournalMarkdown(bill) };
}

export function createRewindLineage(db: DatabaseSync, suffix: string) {
  const checkpoints = createCheckpointRepository(db);
  const campaignId = `test_campaign_${suffix}`;
  const checkpoint = checkpoints.list(campaignId)[0]!;
  const nextDecision = decision(`${suffix}_rewound`, 1);
  const restoredState = structuredClone(checkpoint.state);
  restoredState.metadata.stateVersion = 1;
  restoredState.metadata.turnNumber = 1;
  restoredState.currentDecision = nextDecision;
  return checkpoints.rewind({
    campaignId,
    checkpointId: checkpoint.id,
    requestId: `test_request_rewind_${suffix}`,
    inputHash: `rewind-hash-${suffix}`,
    expectedStateVersion: 0,
    rewindTurnId: `test_turn_rewind_${suffix}`,
    newBranchId: `test_branch_rewind_${suffix}`,
    restoredState,
    restoredStateHash: hashStoredState(restoredState),
    nextDecision,
    createdAt: "2026-09-07T12:30:00.000Z",
  });
}

export function commitPostRewindTurn(db: DatabaseSync, suffix: string) {
  const campaigns = createCampaignRepository(db);
  const turns = createTurnRepository(db);
  const campaign = campaigns.getCampaign(`test_campaign_${suffix}`);
  const turnId = `test_turn_after_rewind_${suffix}`;
  turns.beginTurn({
    turnId,
    campaignId: campaign.id,
    branchId: campaign.activeBranchId,
    clientRequestId: `test_request_after_rewind_${suffix}`,
    expectedStateVersion: campaign.stateVersion,
    decisionId: campaign.currentDecision.id,
    inputHash: `turn-hash-${suffix}`,
    lockedIntents: [billIntent],
    createdAt: "2026-09-07T12:40:00.000Z",
  });
  const plan = resolutionPlan(`after_rewind_${suffix}`);
  turns.persistPlan(turnId, plan);
  turns.persistResolutions(turnId, [checkResolution(`after_rewind_${suffix}`, plan.id, 1)], 1);
  const { candidate, nextDecision } = committedCandidate(campaign.currentState, `after_rewind_${suffix}`, 1);
  turns.persistProposal(turnId, turnProposal(nextDecision), candidate);
  return turns.commitTurn({
    turnId,
    candidateStateHash: hashStoredState(candidate),
    narration: { sceneText: "The party advances after the rewind." },
    nextDecision,
    committedAt: "2026-09-07T12:45:00.000Z",
  });
}
