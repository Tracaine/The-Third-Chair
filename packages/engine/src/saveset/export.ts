import {
  SaveSetModeSchema,
  DecisionRequestSchema,
  WorldStateSchema,
  type PlayerActorView,
  type PlayerJournal,
  type SaveSetManifest,
  type SaveSetMode,
  type WorldState,
} from "@third-chair/contracts";
import { hashStoredState, type ArchiveRow, type CampaignArchiveRepository, type CampaignArchiveSnapshot } from "@third-chair/storage";
import { buildPlayerJournal } from "../journal/build-journal.js";
import { renderPlayerJournalMarkdown } from "../journal/render-markdown.js";
import { projectPlayerView } from "../projection/player-view.js";
import { canonicalJson } from "../canonical-json.js";
import { createSaveSetManifest, type SaveSetContentMember } from "./manifest.js";
import { createSaveSetZip } from "./zip.js";

const encoder = new TextEncoder();

export interface ExportSaveSetInput {
  readonly repository: CampaignArchiveRepository;
  readonly campaignId: string;
  readonly expectedStateVersion: number;
  readonly mode: SaveSetMode;
  readonly createdAt?: string;
}

export interface ExportedSaveSet {
  readonly archive: Uint8Array;
  readonly manifest: SaveSetManifest;
}

function jsonMember(path: string, value: unknown): SaveSetContentMember {
  return { path, bytes: encoder.encode(canonicalJson(value)) };
}

function textMember(path: string, value: string): SaveSetContentMember {
  return { path, bytes: encoder.encode(value) };
}

function parseState(snapshot: CampaignArchiveSnapshot): WorldState {
  const state = WorldStateSchema.parse(JSON.parse(snapshot.campaign.currentStateJson));
  const decision = DecisionRequestSchema.parse(JSON.parse(snapshot.campaign.currentDecisionJson));
  if (state.metadata.campaignId !== snapshot.campaign.id) throw new Error("SAVESET_CAMPAIGN_ID_MISMATCH");
  if (state.metadata.stateVersion !== snapshot.campaign.stateVersion || decision.stateVersion !== snapshot.campaign.stateVersion) {
    throw new Error("SAVESET_STATE_VERSION_MISMATCH");
  }
  if (JSON.stringify(state.currentDecision) !== JSON.stringify(decision)) throw new Error("SAVESET_DECISION_MISMATCH");
  if (hashStoredState(state) !== snapshot.campaign.currentStateHash) throw new Error("SAVESET_STATE_HASH_MISMATCH");
  const seed = Buffer.from(snapshot.campaign.rngSeedBase64, "base64");
  if (seed.byteLength !== 32 || seed.toString("base64") !== snapshot.campaign.rngSeedBase64) {
    throw new Error("SAVESET_RNG_SEED_INVALID");
  }
  return state;
}

function latestBillJournal(snapshot: CampaignArchiveSnapshot, state: WorldState): PlayerJournal {
  const row = [...snapshot.journals]
    .reverse()
    .find((candidate) => candidate.audience === "BILL" && candidate.state_version === state.metadata.stateVersion);
  return row === undefined
    ? buildPlayerJournal(projectPlayerView(state, "BILL"), [])
    : JSON.parse(String(row.journal_json)) as PlayerJournal;
}

function playerCharacters(actors: readonly PlayerActorView[]): readonly PlayerActorView[] {
  return [...actors].sort((left, right) => left.id.localeCompare(right.id));
}

function playerSafeBranches(rows: readonly ArchiveRow[]): readonly object[] {
  return rows.map((row) => ({
    id: row.id,
    parentBranchId: row.parent_branch_id,
    label: row.label,
    status: row.status,
    createdAt: row.created_at,
  }));
}

function collectProvenanceIds(value: unknown, ids: Set<string>): void {
  if (Array.isArray(value)) return value.forEach((item) => collectProvenanceIds(item, ids));
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.kind === "Provenance" && typeof record.text === "string") {
    const separator = record.text.indexOf(":");
    if (separator >= 0) {
      for (const id of record.text.slice(separator + 1).split(",")) if (id.length > 0) ids.add(id);
    }
  }
  for (const nested of Object.values(record)) collectProvenanceIds(nested, ids);
}

function collectCitationIds(snapshot: CampaignArchiveSnapshot, state: WorldState, billView: ReturnType<typeof projectPlayerView>, mode: SaveSetMode): string[] {
  const ids = new Set<string>();
  for (const actor of Object.values(state.actors)) {
    if (actor.controller === "DIRECTOR") continue;
    if (mode === "PLAYER_SAFE" && actor.controller !== "BILL") continue;
    for (const id of actor.featureSourceReferenceIds ?? []) ids.add(id);
    for (const id of actor.sourceReferenceIds ?? []) ids.add(id);
  }
  collectProvenanceIds(mode === "PLAYER_SAFE" ? billView : state, ids);
  if (mode === "FULL_PRIVATE") {
    for (const row of snapshot.turns) {
      for (const column of ["resolution_plan_json", "resolutions_json"] as const) {
        if (row[column] === null) continue;
        const value = JSON.parse(String(row[column])) as unknown;
        const visit = (candidate: unknown): void => {
          if (Array.isArray(candidate)) return candidate.forEach(visit);
          if (candidate !== null && typeof candidate === "object") {
            for (const [key, nested] of Object.entries(candidate)) {
              if (key === "citations" && Array.isArray(nested)) {
                for (const citation of nested) if (typeof citation === "string") ids.add(citation);
              } else visit(nested);
            }
          }
        };
        visit(value);
      }
    }
  }
  return [...ids].sort();
}

function ledgerJsonl(snapshot: CampaignArchiveSnapshot): string {
  const records = [
    ...snapshot.turns.map((data) => ({ recordType: "TURN", data })),
    ...snapshot.turnEvents.map((data) => ({ recordType: "TURN_EVENT", data })),
    ...snapshot.activeTurns.map((data) => ({ recordType: "ACTIVE_TURN", data })),
    ...snapshot.recoveryCommands.map((data) => ({ recordType: "RECOVERY_COMMAND", data })),
    ...snapshot.journals.map((data) => ({ recordType: "JOURNAL", data })),
  ];
  return records.length === 0 ? "" : `${records.map(canonicalJson).join("\n")}\n`;
}

function membersFor(snapshot: CampaignArchiveSnapshot, mode: SaveSetMode): SaveSetContentMember[] {
  const state = parseState(snapshot);
  const billView = projectPlayerView(state, "BILL");
  const billJournal = latestBillJournal(snapshot, state);
  const common: SaveSetContentMember[] = [
    jsonMember("characters.json", playerCharacters(billView.actors)),
    textMember("journal.md", renderPlayerJournalMarkdown(billJournal)),
    jsonMember("rulings.json", billView.acceptedRulings),
    jsonMember("citations.json", collectCitationIds(snapshot, state, billView, mode)),
    jsonMember("branches.json", mode === "PLAYER_SAFE" ? playerSafeBranches(snapshot.branches) : snapshot.branches),
  ];
  if (mode === "PLAYER_SAFE") {
    return [
      ...common,
      jsonMember("player-view.json", billView),
      jsonMember("visible-turn-summaries.json", billJournal.recentTurns),
    ];
  }
  return [
    ...common,
    jsonMember("private/world-state.json", {
      campaign: {
        id: snapshot.campaign.id,
        ownerId: snapshot.campaign.ownerId,
        name: snapshot.campaign.name,
        sourcePackHash: snapshot.campaign.sourcePackHash,
        stateVersion: snapshot.campaign.stateVersion,
        currentStateJson: snapshot.campaign.currentStateJson,
        currentStateHash: snapshot.campaign.currentStateHash,
        currentDecisionJson: snapshot.campaign.currentDecisionJson,
        activeBranchId: snapshot.campaign.activeBranchId,
        status: snapshot.campaign.status,
        createdAt: snapshot.campaign.createdAt,
        updatedAt: snapshot.campaign.updatedAt,
      },
    }),
    jsonMember("private/rng.json", {
      seedBase64: snapshot.campaign.rngSeedBase64,
      counter: state.metadata.rngCounter,
    }),
    textMember("private/turns.jsonl", ledgerJsonl(snapshot)),
    jsonMember("private/checkpoints.json", snapshot.checkpoints),
    jsonMember("private/creation.json", snapshot.creationRequests),
  ];
}

export function exportSaveSet(input: ExportSaveSetInput): ExportedSaveSet {
  const mode = SaveSetModeSchema.parse(input.mode);
  const snapshot = input.repository.readCampaign(input.campaignId);
  if (snapshot.campaign.stateVersion !== input.expectedStateVersion) throw new Error("STATE_VERSION_CONFLICT");
  const members = membersFor(snapshot, mode);
  const manifest = createSaveSetManifest({
    mode,
    campaignId: snapshot.campaign.id,
    campaignName: snapshot.campaign.name,
    stateVersion: snapshot.campaign.stateVersion,
    stateHash: snapshot.campaign.currentStateHash,
    sourcePackManifestHash: snapshot.campaign.sourcePackHash,
    activeBranchId: snapshot.campaign.activeBranchId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    members,
  });
  const archive = createSaveSetZip({
    mode,
    members: [jsonMember("manifest.json", manifest), ...members],
  });
  return { archive, manifest };
}
