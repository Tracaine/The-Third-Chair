import { createCampaignArchiveRepository, createCampaignCreationRepository, createCampaignRepository, createCheckpointRepository, createExportRepository, createTurnRepository } from "@third-chair/storage";
import { WorldStateSchema, type ResolutionPlan } from "@third-chair/contracts";
import { characterCatalogFromSourceOptions, createCampaignBuilder, createStarterCharacterCatalog, createTurnEngine, FakeDirector, FakeNarrator, sha256Json } from "@third-chair/engine";
import { loadAgentConfig } from "@third-chair/agents";
import { readConfig } from "./config.js";
import { createHttpApp } from "./http/app.js";
import { createMcpServer, createSdkMcpServer } from "./mcp/server.js";
import { createLiveModelPorts } from "./runtime/model-ports.js";
import { createFakeSourcePack } from "./runtime/fake-source-pack.js";
import { createFakeCampaignSpine } from "./runtime/fake-campaign-spine.js";
import { mutationRecoveryGuard, performStartup, startupErrorDiagnostic } from "./startup.js";

const config = readConfig();
const startup = (() => {
  try { return performStartup(); }
  catch (error) {
    process.stderr.write(`${JSON.stringify(startupErrorDiagnostic(error))}\n`);
    process.exit(1);
  }
})();
const db = startup.db; const campaigns = createCampaignRepository(db); const turns = createTurnRepository(db);
const checkpoints = createCheckpointRepository(db);
const creationRequests = createCampaignCreationRepository(db);
const archives = createCampaignArchiveRepository(db);
const exports = createExportRepository(db);
const sourcePackDb = startup.sourcePackDatabase;
const sourcePack = config.fakeMode ? createFakeSourcePack() : startup.sourcePack;
const campaignId = "test_demo_campaign";
if (config.fakeMode && sourcePack) try { campaigns.getCampaign(campaignId); } catch {
  const decision = { id: "test_demo_decision", stateVersion: 0, mode: "EXPLORATION" as const, owner: "BOTH" as const, eligibleActorIds: ["test_demo_bill", "test_demo_raven"], situation: "A desk waits in a lamplit room.", constraints: "State your actions.", requiredInput: "Both players act.", legalOptions: [] };
  const state = WorldStateSchema.parse({ metadata: { schemaVersion: 1, campaignId, turnNumber: 0, stateVersion: 0, worldDate: { yearDr: 1375, month: "Mirtul", day: 1 }, currentLocationId: "test_demo_room", sceneId: "test_demo_scene", rngCounter: 0 }, table: { rulesEdition: "SRD_5_1", settingDateDr: 1375, diceMode: "SERVER_OPEN", deathMode: "STANDARD", houseRules: [] }, actors: Object.fromEntries([["test_demo_bill", "BILL"], ["test_demo_raven", "RAVEN"]].map(([id, controller]) => [id, { controller, name: controller === "BILL" ? "Bill" : "Raven", level: 1, classSourceKey: "fighter", ancestrySourceKey: "human", backgroundSourceKey: "wanderer", abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }, proficiencyBonus: 2, armorClass: 10, maxHp: 10, currentHp: 10, temporaryHp: 0, speed: 30, conditions: [], deathSaves: { successes: 0, failures: 0 }, resources: {}, spells: [], equipmentIds: [], publicNotes: [], scopedNotes: [] }])), inventory: {}, combat: null, locations: { test_demo_room: { id: "test_demo_room", audience: "PUBLIC", name: "Lamplit room", status: "Explored", facts: [] } }, npcs: {}, factions: {}, quests: {}, facts: [], events: [], clocks: {}, flags: [], currentDecision: decision });
  campaigns.createCampaign({ id: campaignId, ownerId: "local", name: config.fakeMode ? "Fake demo" : "Live demo",
    sourcePackHash: sourcePack?.manifest().sourcePackManifestHash ?? "unavailable", rngSeed: new Uint8Array(32),
    currentState: state, currentStateHash: sha256Json(state), rootBranchId: "test_demo_branch", rootBranchLabel: "Main" });
}
const fakePorts = () => ({
  director: new FakeDirector((input) => { const plan: ResolutionPlan = { id: "test_demo_plan", checks: [{ id: "test_demo_check", actorId: "test_demo_raven", checkKind: "Investigation", key: "investigation", sides: 20, advantage: "NORMAL" as const, advantageReason: "No modifier", modifier: 0, dc: 10, visibility: "PUBLIC" as const, successStakes: "Find a clue", failureStakes: "Lose time", permittedOutcomeTiers: ["SUCCESS", "CRITICAL_SUCCESS", "FAILURE", "CRITICAL_FAILURE"], citations: ["SRD"] }] }; const rolls = input.runtime.lockAndResolveChecks(plan); return { uncontestedOperations: [], checkLinkedOperations: [{ id: "test_demo_fact", kind: "ADD_FACT" as const, reason: "Desk search", audience: "PARTY" as const, cause: { type: "RESOLUTION" as const, resolutionId: rolls.resolutions[0]!.id, allowedOutcomeTiers: [rolls.resolutions[0]!.tier] }, fact: { id: "test_demo_clue", audience: "PARTY" as const, kind: "Clue", text: "A note names a river crossing." } }], memoryWrites: [], riskTags: [], nextDecision: { ...input.state.currentDecision, id: "test_demo_next", stateVersion: 999, owner: "BILL" as const, eligibleActorIds: ["test_demo_bill"] }, narrativeBrief: { summary: "A clue is found.", requiredResolutionIds: ["test_demo_check"], requiredEventIds: [] } }; }),
  narrator: new FakeNarrator((input) => ({ sceneText: `Roll ${input.resolutions[0]?.keptDie ?? ""}: a clue emerges.`, spokenNpcLines: [], mustIncludeResolutionIds: input.proposal.narrativeBrief.requiredResolutionIds, mustIncludeEventIds: [], visibleEventIds: [] })),
});
const ports = config.fakeMode ? fakePorts() : sourcePack
  ? createLiveModelPorts(loadAgentConfig(process.env), sourcePack)
  : fakePorts();
const engine = createTurnEngine({ campaigns, turns, director: ports.director, narrator: ports.narrator });
const campaignCreator = sourcePack ? createCampaignBuilder({ campaigns, creationRequests, sourcePack,
  loadCharacterCatalog: () => {
    if (!sourcePack.characterOptions) throw new Error("CHARACTER_OPTIONS_UNAVAILABLE");
    const options = sourcePack.characterOptions();
    return options.length === 0 ? createStarterCharacterCatalog() : characterCatalogFromSourceOptions(options);
  },
  spine: config.fakeMode ? createFakeCampaignSpine() : (ports as ReturnType<typeof createLiveModelPorts>).campaignSpine }) : undefined;
const widgetResource = startup.widgetResource;
const exportDirectory = startup.exportDirectory;
const serverDeps = { campaigns, turns, engine, checkpoints, archives, exports,
  exportDirectory, resourceOwnerId: process.env.THIRD_CHAIR_OWNER_ID ?? "bill-local",
  mutationGuard: mutationRecoveryGuard(startup),
  ...(sourcePack ? { sourcePack } : {}),
  ...(campaignCreator ? { campaignCreator } : {}) };
const mcp = createMcpServer(serverDeps);
const httpServer = createHttpApp(
  mcp,
  config.fakeMode,
  () => createSdkMcpServer(serverDeps, widgetResource),
  { status: startup.status, ...(startup.recoveryCode ? { recoveryCode: startup.recoveryCode } : {}) },
).listen(config.port, config.host, () => process.stdout.write(`${JSON.stringify({ level: "info", code: "SERVER_LISTENING", status: startup.status, port: config.port })}\n`));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  httpServer.close(() => {
    sourcePackDb?.close();
    db.close();
    process.exit(0);
  });
});
