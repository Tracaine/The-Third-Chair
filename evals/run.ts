import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WorldStateSchema, type AdvanceGameCommand, type SourcePackService } from "@third-chair/contracts";
import { loadAgentConfig, OpenAiDirectorAdapter, OpenAiNarratorAdapter } from "@third-chair/agents";
import { createTurnEngine, FailureInjector, type NarratorPort, sha256Json } from "@third-chair/engine";
import { createCampaignRepository, createTurnRepository, openCampaignDatabase, runMigrationsWithBackup } from "@third-chair/storage";
import { createSqliteSourcePackService, openSourcePackReadOnly } from "@third-chair/source-pack";
import { gradeChair003, type EvalExpectation } from "./graders.js";

interface EvalCase { name: string; mode: "NORMAL" | "FAIL_NARRATOR" | "RESTART_AFTER_RESOLVED"; declaredAction: string; desiredOutcome: string; approach: string; expectation: EvalExpectation; }
interface RedactedResult { name: string; passed: boolean; elapsedMs: number; finalKind: string; rollCount: number; errorCode?: string; }

function safeError(error: unknown): string {
  return error instanceof Error && /^[A-Z][A-Z0-9_:.-]{2,100}$/.test(error.message) ? error.message : "EVAL_FAILED";
}

function cases(): EvalCase[] {
  return readFileSync(new URL("./cases/chair-003.jsonl", import.meta.url), "utf8").trim().split(/\r?\n/)
    .map((line) => JSON.parse(line) as EvalCase);
}

function stateFor(name: string) {
  const base = JSON.parse(readFileSync(new URL("./fixtures/chair-003-state.json", import.meta.url), "utf8")) as Record<string, unknown>;
  const safe = name.replaceAll("-", "_");
  const state = structuredClone(base) as any;
  state.metadata.campaignId = `test_eval_campaign_${safe}`;
  state.metadata.sceneId = `test_eval_scene_${safe}`;
  state.currentDecision.id = `test_eval_decision_${safe}`;
  return WorldStateSchema.parse(state);
}

async function runCase(testCase: EvalCase, sourcePack: SourcePackService): Promise<RedactedResult> {
  const started = performance.now();
  const directory = mkdtempSync(join(tmpdir(), "third-chair-eval-"));
  const path = join(directory, "campaigns.sqlite");
  let db: ReturnType<typeof openCampaignDatabase> | null = null;
  try {
    runMigrationsWithBackup(path); db = openCampaignDatabase(path);
    const state = stateFor(testCase.name);
    const campaigns = createCampaignRepository(db); const turns = createTurnRepository(db);
    campaigns.createCampaign({ id: state.metadata.campaignId, ownerId: "local", name: testCase.name,
      sourcePackHash: sourcePack.manifest().sourcePackManifestHash, rngSeed: new Uint8Array(32).fill(7),
      currentState: state, currentStateHash: sha256Json(state), rootBranchId: `test_eval_branch_${testCase.name.replaceAll("-", "_")}`,
      rootBranchLabel: "Main" });
    const command: AdvanceGameCommand = { kind: "INTENTS", campaignId: state.metadata.campaignId,
      expectedStateVersion: 0, decisionId: state.currentDecision.id,
      clientRequestId: `test_eval_request_${testCase.name.replaceAll("-", "_")}`,
      intents: [{ seat: "BILL", actorId: "test_actor_bill", mode: "ACT", declaredAction: testCase.declaredAction,
        desiredOutcome: testCase.desiredOutcome, approach: testCase.approach,
        committedResourceIds: [], targetIds: [], contingency: "Stop if the situation changes." }] };
    const config = loadAgentConfig(process.env);
    const director = new OpenAiDirectorAdapter({ config, sourcePack });
    const realNarrator = new OpenAiNarratorAdapter({ config });
    const failedNarrator: NarratorPort = { narrate: () => { throw new Error("FORCED_NARRATOR_FAILURE"); } };
    const turnId = `test_eval_turn_${testCase.name.replaceAll("-", "_")}`;

    if (testCase.mode === "RESTART_AFTER_RESOLVED") {
      const first = createTurnEngine({ campaigns, turns, director, narrator: realNarrator,
        newTurnId: () => turnId, failureInjector: new FailureInjector("RESOLVED") });
      let interruptionError: unknown = null;
      try { await first.advanceGame(command); } catch (error) { interruptionError = error; }
      const interrupted = turns.getTurn(turnId);
      const beforeDice = interrupted.resolutions?.map(({ naturalDice }) => [...naturalDice]) ?? null;
      if (interrupted.status !== "RESOLVED" || beforeDice === null) {
        const upstream = safeError(interruptionError);
        throw new Error(upstream === "EVAL_FAILED" ? "RESTART_EVIDENCE_MISSING" : upstream);
      }
      const resumed = await createTurnEngine({ campaigns, turns, director, narrator: realNarrator,
        newTurnId: () => "test_eval_unused_turn" }).advanceGame(command);
      const stored = turns.getTurn(turnId);
      const evidence = { finalKind: resumed.kind, rollCount: stored.resolutions?.length ?? 0,
        rngCounter: campaigns.getCampaign(state.metadata.campaignId).currentState.metadata.rngCounter,
        beforeDice, afterDice: stored.resolutions?.map(({ naturalDice }) => [...naturalDice]) ?? null };
      return { name: testCase.name, passed: gradeChair003(testCase.expectation, evidence),
        elapsedMs: Math.round(performance.now() - started), finalKind: resumed.kind, rollCount: evidence.rollCount };
    }

    const result = await createTurnEngine({ campaigns, turns, director,
      narrator: testCase.mode === "FAIL_NARRATOR" ? failedNarrator : realNarrator,
      newTurnId: () => turnId, newRecoveryDecisionId: () => `test_eval_recovery_${testCase.name.replaceAll("-", "_")}` }).advanceGame(command);
    const stored = turns.getTurn(turnId);
    const evidence = { finalKind: result.kind, rollCount: stored.resolutions?.length ?? 0,
      rngCounter: campaigns.getCampaign(state.metadata.campaignId).currentState.metadata.rngCounter };
    return { name: testCase.name, passed: gradeChair003(testCase.expectation, evidence),
      elapsedMs: Math.round(performance.now() - started), finalKind: result.kind, rollCount: evidence.rollCount };
  } catch (error) {
    return { name: testCase.name, passed: false, elapsedMs: Math.round(performance.now() - started),
      finalKind: "FAILED", rollCount: 0, errorCode: safeError(error) };
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
}

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY_REQUIRED");
const sourceDb = openSourcePackReadOnly(resolve(process.env.THIRD_CHAIR_SOURCE_PACK_DATABASE ?? "private/source-pack.sqlite"));
try {
  const sourcePack = createSqliteSourcePackService(sourceDb);
  const results: RedactedResult[] = [];
  for (const testCase of cases()) results.push(await runCase(testCase, sourcePack));
  mkdirSync(resolve("evals/results"), { recursive: true });
  writeFileSync(resolve("evals/results/latest.json"), `${JSON.stringify({ runAt: new Date().toISOString(), results }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (results.some(({ passed }) => !passed)) process.exitCode = 1;
} finally { sourceDb.close(); }
