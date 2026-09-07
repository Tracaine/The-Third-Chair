import { randomBytes, randomUUID } from "node:crypto";
import {
  CampaignCreationRequestSchema,
  CampaignSpineInputSchema,
  CampaignSpineProposalSchema,
  WorldStateSchema,
  type Audience,
  type CampaignCreationRequest,
  type CampaignSpineInput,
  type CampaignSpineProposal,
  type CharacterBuild,
  type PublicCharacterCard,
  type SourcePackService,
  type WorldState,
} from "@third-chair/contracts";
import type { CampaignCreationRepository, CampaignRepository } from "@third-chair/storage";
import { sha256Json } from "../hash.js";
import { buildLevelOneCharacter } from "./character-builder.js";
import type { CharacterCatalog } from "./catalog.js";
import { validateCharacterOwnership } from "./validate-character.js";

export interface CampaignSpinePort {
  generate(input: CampaignSpineInput): Promise<CampaignSpineProposal>;
}

export interface CampaignCreationResult {
  readonly campaignId: string;
  readonly sourcePackHash: string;
  readonly visibleOpening: string;
  readonly characters: readonly PublicCharacterCard[];
  readonly currentDecision: WorldState["currentDecision"];
  readonly stateHash: string;
}

interface IdFactory {
  readonly campaign: () => string;
  readonly branch: () => string;
  readonly location: () => string;
  readonly scene: () => string;
  readonly decision: () => string;
  readonly record: (kind: string, key: string) => string;
}

export interface CampaignBuilderDependencies {
  readonly campaigns: CampaignRepository;
  readonly creationRequests: CampaignCreationRepository;
  readonly sourcePack: Pick<SourcePackService, "manifest">;
  readonly loadCharacterCatalog: () => CharacterCatalog;
  readonly spine: CampaignSpinePort;
  readonly ids?: Partial<IdFactory>;
  readonly rngSeed?: () => Uint8Array;
  readonly now?: () => string;
}

export interface CampaignBuilder {
  create(input: unknown): Promise<CampaignCreationResult>;
}

const defaultIds: IdFactory = {
  campaign: randomUUID,
  branch: randomUUID,
  location: randomUUID,
  scene: randomUUID,
  decision: randomUUID,
  record: () => randomUUID(),
};

function actor(build: CharacterBuild, equipmentIds: readonly string[]) {
  return {
    controller: build.controller,
    name: build.name,
    level: build.level,
    experiencePoints: 0,
    classSourceKey: build.classSourceKey,
    ancestrySourceKey: build.ancestrySourceKey,
    backgroundSourceKey: build.backgroundSourceKey,
    abilities: build.abilities,
    proficiencyBonus: build.proficiencyBonus,
    armorClass: build.armorClass,
    maxHp: build.maxHp,
    currentHp: build.maxHp,
    temporaryHp: 0,
    speed: build.speed,
    conditions: [],
    deathSaves: { successes: 0, failures: 0 },
    resources: build.resources,
    spells: build.spells,
    equipmentIds: [...equipmentIds],
    pronouns: build.pronouns,
    saves: build.saves,
    saveProficiencies: build.saveProficiencies,
    skills: build.skills,
    skillProficiencies: build.skillProficiencies,
    spellSlots: build.spellSlots,
    featureSourceReferenceIds: build.featureSourceReferenceIds,
    sourceReferenceIds: build.sourceReferenceIds,
    characterHook: build.characterHook,
    publicNotes: build.characterHook ? [build.characterHook] : [],
    scopedNotes: [],
  };
}

function sourceFacts(recordId: string, audience: Audience, origin: string, citationIds: readonly string[]) {
  return [{ id: recordId, audience, kind: "Provenance", text: `${origin}:${citationIds.join(",")}` }];
}

function buildInitialState(args: {
  request: CampaignCreationRequest;
  spine: CampaignSpineProposal;
  bill: CharacterBuild;
  raven: CharacterBuild;
  catalog: CharacterCatalog;
  campaignId: string;
  locationId: string;
  sceneId: string;
  decisionId: string;
  recordId(kind: string, key: string): string;
}): WorldState {
  const { request, spine, bill, raven, catalog } = args;
  const builds = [bill, raven];
  const runtimeEquipment = new Map<string, string[]>();
  const inventory = Object.fromEntries(builds.flatMap((build) => build.equipmentIds.map((catalogId) => {
    const id = args.recordId("item", `${build.actorId}_${catalogId}`);
    runtimeEquipment.set(build.actorId, [...(runtimeEquipment.get(build.actorId) ?? []), id]);
    return [id, { id, name: catalog.equipment[catalogId]?.displayName ?? catalogId,
      ownerActorId: build.actorId, containerId: null, quantity: 1, equippedSlots: [], facts: [] }];
  })));
  const decision = {
    id: args.decisionId,
    stateVersion: 0,
    mode: "EXPLORATION" as const,
    owner: "BOTH" as const,
    eligibleActorIds: [bill.actorId, raven.actorId],
    situation: `${spine.opening.locationName}: ${spine.opening.pressure.text}`,
    constraints: "Bill and Raven choose only their own character's action.",
    requiredInput: "Bill and Raven each declare an action, desired outcome, and approach.",
    legalOptions: [],
  };
  const locations = {
    [args.locationId]: {
      id: args.locationId, audience: spine.opening.location.audience,
      name: spine.opening.locationName, status: "OPENING",
      facts: [
        { id: args.recordId("fact", "opening_location"), audience: spine.opening.location.audience, kind: "Setting", text: spine.opening.location.text },
        ...sourceFacts(args.recordId("source", "opening_location"), spine.opening.location.audience, spine.opening.location.origin, spine.opening.location.citationIds),
        { id: args.recordId("fact", "opening_pressure"), audience: spine.opening.pressure.audience, kind: "Pressure", text: spine.opening.pressure.text },
        ...sourceFacts(args.recordId("source", "opening_pressure"), spine.opening.pressure.audience, spine.opening.pressure.origin, spine.opening.pressure.citationIds),
      ],
    },
  };
  const factions = Object.fromEntries(spine.factions.map((faction) => {
    const id = args.recordId("faction", faction.key);
    return [id, { id, audience: faction.goal.audience, name: faction.name, status: "UNREVEALED", facts: [
      { id: args.recordId("fact", `faction_${faction.key}`), audience: faction.goal.audience, kind: "Goal", text: faction.goal.text },
      ...sourceFacts(args.recordId("source", `faction_${faction.key}`), faction.goal.audience, faction.goal.origin, faction.goal.citationIds),
    ] }];
  }));
  const clocks = Object.fromEntries(spine.factions.map((faction) => {
    const clock = faction.clock;
    const id = args.recordId("clock", clock.key);
    return [id, { id, audience: clock.audience, name: clock.name, status: "UNREVEALED", current: clock.current,
      maximum: clock.segments, facts: sourceFacts(args.recordId("source", `clock_${clock.key}`), clock.audience, clock.origin, clock.citationIds) }];
  }));
  const npcs = Object.fromEntries(spine.npcs.map((npc) => {
    const id = args.recordId("npc", npc.key);
    return [id, { id, audience: npc.audience, name: npc.name, status: "UNREVEALED", facts: [
      { id: args.recordId("fact", `npc_intention_${npc.key}`), audience: npc.audience, kind: "Intention", text: npc.intention },
      ...npc.relationships.map((text, index) => ({ id: args.recordId("fact", `npc_relationship_${npc.key}_${index}`), audience: npc.audience, kind: "Relationship", text })),
      { id: args.recordId("fact", `npc_contradiction_${npc.key}`), audience: npc.audience, kind: "Contradiction", text: npc.contradiction },
      ...sourceFacts(args.recordId("source", `npc_${npc.key}`), npc.audience, npc.origin, npc.citationIds),
    ] }];
  }));
  const quests = Object.fromEntries(spine.routes.map((route) => {
    const id = args.recordId("route", route.key);
    return [id, { id, audience: route.premise.audience, name: route.key, status: `UNREVEALED:${route.method}`, facts: [
      { id: args.recordId("fact", `route_${route.key}`), audience: route.premise.audience, kind: "Route", text: route.premise.text },
      ...sourceFacts(args.recordId("source", `route_${route.key}`), route.premise.audience, route.premise.origin, route.premise.citationIds),
    ] }];
  }));
  const facts = [
    { id: args.recordId("fact", "central_truth"), audience: spine.centralTruth.audience, kind: "Central Truth", text: spine.centralTruth.text },
    ...sourceFacts(args.recordId("source", "central_truth"), spine.centralTruth.audience, spine.centralTruth.origin, spine.centralTruth.citationIds),
    ...spine.outcomes.flatMap((outcome) => [
      { id: args.recordId("outcome", outcome.key), audience: outcome.audience, kind: "Outcome", text: outcome.text },
      ...sourceFacts(args.recordId("source", `outcome_${outcome.key}`), outcome.audience, outcome.origin, outcome.citationIds),
    ]),
    ...spine.startingClues.flatMap((clue) => [
      { id: args.recordId("clue", clue.key), audience: clue.audience, kind: "Clue", text: clue.text },
      ...sourceFacts(args.recordId("source", `clue_${clue.key}`), clue.audience, clue.origin, clue.citationIds),
    ]),
  ];
  const flags = spine.riskTags.map((risk) => ({ id: args.recordId("risk", risk.key), audience: risk.audience,
    key: `RISK:${risk.key}`, text: `${risk.origin}:${risk.text}:${risk.citationIds.join(",")}` }));
  return WorldStateSchema.parse({
    metadata: { schemaVersion: 1, campaignId: args.campaignId, turnNumber: 0, stateVersion: 0,
      worldDate: { yearDr: request.setting.startDateDr, month: "Mirtul", day: 1 },
      currentLocationId: args.locationId, sceneId: args.sceneId, rngCounter: 0 },
    table: { rulesEdition: "SRD_5_1", settingDateDr: 1375, diceMode: "SERVER_OPEN", deathMode: "STANDARD", houseRules: [] },
    actors: Object.fromEntries(builds.map((build) => [build.actorId, actor(build, runtimeEquipment.get(build.actorId) ?? [])])),
    inventory, combat: null, locations, npcs, factions, quests, facts,
    events: [{ id: args.recordId("journal", "campaign_start"), audience: "PARTY", kind: "Campaign Journal", text: spine.opening.pressure.text }],
    clocks, flags, currentDecision: decision,
  });
}

function reconstruct(campaign: ReturnType<CampaignRepository["getCampaign"]>): CampaignCreationResult {
  const characters = Object.entries(campaign.currentState.actors)
    .filter(([, value]) => value.controller === "BILL" || value.controller === "RAVEN")
    .map(([actorId, value]) => ({ actorId, controller: value.controller as "BILL" | "RAVEN", name: value.name,
      pronouns: value.pronouns ?? "", level: 1 as const, ancestrySourceKey: value.ancestrySourceKey,
      classSourceKey: value.classSourceKey, backgroundSourceKey: value.backgroundSourceKey, abilities: value.abilities,
      proficiencyBonus: value.proficiencyBonus, armorClass: value.armorClass, maxHp: value.maxHp, speed: value.speed }))
    .sort((left, right) => left.controller.localeCompare(right.controller));
  return { campaignId: campaign.id, sourcePackHash: campaign.sourcePackHash,
    visibleOpening: campaign.currentDecision.situation, characters,
    currentDecision: campaign.currentDecision, stateHash: campaign.currentStateHash };
}

function failure(error: unknown) {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message)
    ? error.message : "CAMPAIGN_CREATION_FAILED";
  return { code, message: code };
}

export function createCampaignBuilder(deps: CampaignBuilderDependencies): CampaignBuilder {
  const ids: IdFactory = { ...defaultIds, ...deps.ids };
  const now = deps.now ?? (() => new Date().toISOString());
  return { async create(rawInput) {
    const request = CampaignCreationRequestSchema.parse(rawInput);
    const inputHash = sha256Json(JSON.parse(JSON.stringify(request)));
    const begun = deps.creationRequests.begin({ requestId: request.requestId, ownerId: request.ownerId, inputHash, createdAt: now() });
    if (begun.kind === "EXISTING") {
      if (begun.request.status === "COMMITTED" && begun.request.campaignId) return reconstruct(deps.campaigns.getCampaign(begun.request.campaignId));
      throw new Error("CAMPAIGN_CREATION_IN_PROGRESS");
    }
    try {
      if (deps.sourcePack.manifest().sourcePackManifestHash !== request.sourcePackHash) throw new Error("SOURCE_PACK_HASH_MISMATCH");
      if (!request.billCharacter) throw new Error("AWAITING_BILL_CHARACTER");
      if (!request.ravenCharacter) throw new Error("AWAITING_RAVEN_CHARACTER");
      const catalog = deps.loadCharacterCatalog();
      const ownership = validateCharacterOwnership({
        bill: buildLevelOneCharacter(request.billCharacter, "BILL", catalog),
        raven: buildLevelOneCharacter(request.ravenCharacter, "RAVEN", catalog),
      });
      if (ownership.status !== "READY") throw new Error(ownership.status);
      const spineInput = CampaignSpineInputSchema.parse({ requestId: request.requestId, campaignName: request.campaignName,
        tone: request.tone, boundaries: request.boundaries, sourcePackHash: request.sourcePackHash, setting: request.setting,
        characters: [ownership.bill, ownership.raven].map((character) => ({ controller: character.controller,
          name: character.name, classSourceKey: character.classSourceKey, ancestrySourceKey: character.ancestrySourceKey,
          backgroundSourceKey: character.backgroundSourceKey, characterHook: character.characterHook })) });
      const spine = CampaignSpineProposalSchema.parse(await deps.spine.generate(spineInput));
      const campaignId = ids.campaign();
      const branchId = ids.branch();
      const state = buildInitialState({ request, spine, bill: ownership.bill, raven: ownership.raven, catalog,
        campaignId, locationId: ids.location(), sceneId: ids.scene(), decisionId: ids.decision(), recordId: ids.record });
      const stateHash = sha256Json(state);
      const seed = (deps.rngSeed ?? (() => randomBytes(32)))();
      const createdAt = now();
      const result = reconstruct({ id: campaignId, ownerId: request.ownerId, name: request.campaignName,
        sourcePackHash: request.sourcePackHash, rngSeed: seed, stateVersion: 0, currentState: state,
        currentStateHash: stateHash, currentDecision: state.currentDecision, activeBranchId: branchId, status: "ACTIVE",
        createdAt, updatedAt: createdAt });
      deps.creationRequests.commit(request.requestId, inputHash, { id: campaignId, ownerId: request.ownerId,
        name: request.campaignName, sourcePackHash: request.sourcePackHash, rngSeed: seed, currentState: state,
        currentStateHash: stateHash, rootBranchId: branchId,
        rootBranchLabel: "Campaign Start", createdAt });
      return result;
    } catch (error) {
      deps.creationRequests.fail(request.requestId, inputHash, failure(error), now());
      throw error;
    }
  } };
}
