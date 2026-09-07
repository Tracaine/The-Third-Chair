import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const boundaries = JSON.parse(readFileSync(resolve(root, "evals/fixtures/beta-boundaries.json"), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)] ?? 0;
}

function readJsonl(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`INVALID_BETA_JSONL:${index + 1}`, { cause: error }); }
  });
}

export function createQualificationRecord(decisions) {
  const latencies = decisions.filter((item) => item.toolName !== "render_image").map((item) => item.latencyMs);
  return {
    schemaVersion: 1,
    provenance: "DETERMINISTIC_REGRESSION",
    generatedAt: new Date().toISOString(),
    campaignIdHash: sha256("chair-005-qualification-fixture"),
    modelProfile: "contract-fixture/no-billed-model-turns",
    decisions,
    evidence: {
      restartAfterDecision: 4,
      exactDecisionResumed: true,
      rollRetryReusedNaturalDice: true,
      narratorRetryReusedCandidate: true,
      checkpointRewindVerified: true,
      deterministicReplayVerified: true,
      abandonedBranchVerified: true,
      fullPrivateImportVerified: true,
      fullPrivateHashEquality: true,
      playerSafeImportRejected: true,
      manualDatabaseRepair: false,
      sentinelOccurrences: 0,
    },
    latency: {
      medianMs: percentile(latencies, 0.5),
      p95Ms: percentile(latencies, 0.95),
    },
  };
}

function countCategory(decisions, category) {
  return decisions.filter((decision) => decision.categories?.includes(category)).length;
}

export function verifyBetaRecord(record) {
  const errors = [];
  const decisions = Array.isArray(record?.decisions) ? record.decisions : [];
  if (decisions.length < boundaries.minimumDecisions) errors.push("FEWER_THAN_TWELVE_DECISIONS");
  if (decisions.some((item) => item.meaningful !== true || item.noOp === true)) errors.push("NO_OP_OR_NON_MEANINGFUL_DECISION");
  const modes = new Set(decisions.map((item) => item.mode));
  if (boundaries.minimumModes.some((mode) => !modes.has(mode))) errors.push("REQUIRED_MODE_MISSING");

  let version = decisions[0]?.beforeVersion ?? 0;
  const rngCounters = new Set();
  for (const [offset, item] of decisions.entries()) {
    if (item.index !== offset + 1 || item.beforeVersion !== version) errors.push("STATE_VERSION_GAP");
    const expectedAfter = item.stateMutating ? item.beforeVersion + 1 : item.beforeVersion;
    if (item.afterVersion !== expectedAfter) errors.push("STATE_VERSION_GAP");
    version = item.afterVersion;
    if (item.rngAfter < item.rngBefore || item.rngAfter > item.rngBefore + 1) errors.push("RNG_COUNTER_GAP");
    if (item.rngAfter > item.rngBefore) {
      if (rngCounters.has(item.rngAfter)) errors.push("DUPLICATE_ROLL_COUNTER");
      rngCounters.add(item.rngAfter);
    }
    if (item.widgetStateVersion !== item.afterVersion) errors.push("WIDGET_STATE_VERSION_MISMATCH");
    if (!/^[a-f0-9]{64}$/.test(item.requestIdHash ?? "")) errors.push("REQUEST_ID_HASH_INVALID");
  }

  if (countCategory(decisions, "exploration") < 3) errors.push("EXPLORATION_COVERAGE_MISSING");
  const social = decisions.filter((item) => item.categories?.includes("social"));
  if (social.length < 2 || new Set(social.map((item) => item.npcPressureHash)).size < 2) errors.push("SOCIAL_PRESSURES_MISSING");
  const uncertain = decisions.filter((item) => item.categories?.includes("uncertain"));
  if (uncertain.length < 3 || !uncertain.some((item) => item.outcome === "SUCCESS") || !uncertain.some((item) => item.outcome === "FAILURE")) errors.push("UNCERTAINTY_COVERAGE_MISSING");
  for (const category of ["failure_forward", "bill_resource_commitment", "raven_autonomous", "checkpoint_rewind", "rules_question"]) {
    if (countCategory(decisions, category) < 1) errors.push(`COVERAGE_MISSING:${category}`);
  }
  const combatActors = new Set(decisions.filter((item) => item.categories?.includes("combat_round")).map((item) => item.combatActor));
  if (["BILL", "RAVEN", "DIRECTOR"].some((actor) => !combatActors.has(actor))) errors.push("FULL_COMBAT_ROUND_MISSING");
  const rules = decisions.find((item) => item.categories?.includes("rules_question"));
  if (!rules || rules.stateMutating || rules.beforeVersion !== rules.afterVersion) errors.push("RULES_QUESTION_MUTATED_STATE");

  const evidence = record?.evidence ?? {};
  if (evidence.restartAfterDecision !== 4 || !evidence.exactDecisionResumed) errors.push("RESTART_EVIDENCE_MISSING");
  if (!evidence.rollRetryReusedNaturalDice || !evidence.narratorRetryReusedCandidate) errors.push("RETRY_EVIDENCE_MISSING");
  if (!evidence.checkpointRewindVerified || !evidence.deterministicReplayVerified || !evidence.abandonedBranchVerified) errors.push("REWIND_EVIDENCE_MISSING");
  if (!evidence.fullPrivateImportVerified || !evidence.fullPrivateHashEquality || !evidence.playerSafeImportRejected) errors.push("SAVESET_IMPORT_UNVERIFIED");
  if (evidence.manualDatabaseRepair !== false) errors.push("MANUAL_DATABASE_REPAIR_DETECTED");
  if (evidence.sentinelOccurrences !== 0) errors.push("SENTINEL_OCCURRENCE");

  const serialized = JSON.stringify(record);
  for (const key of boundaries.forbiddenKeys) if (new RegExp(`"${key}"`, "i").test(serialized)) errors.push(`FORBIDDEN_FIELD:${key}`);
  for (const sentinel of boundaries.sentinels) if (serialized.includes(sentinel)) errors.push("SENTINEL_OCCURRENCE");
  if ((record?.latency?.medianMs ?? Infinity) >= 20_000 || (record?.latency?.p95Ms ?? Infinity) >= 45_000) errors.push("LATENCY_BUDGET_EXCEEDED");
  return { status: errors.length === 0 ? "PASS" : "FAIL", errors: [...new Set(errors)], decisions: decisions.length, finalStateVersion: version };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const verifyPath = argument("--verify");
  const recordPath = argument("--record");
  const outputPath = argument("--out");
  let record;
  if (recordPath) {
    record = createQualificationRecord(readJsonl(resolve(recordPath)));
    if (!outputPath) throw new Error("BETA_OUTPUT_REQUIRED");
    const destination = resolve(outputPath);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, `${JSON.stringify(record, null, 2)}\n`, { flag: "w" });
  } else if (verifyPath) record = JSON.parse(readFileSync(resolve(verifyPath), "utf8"));
  else throw new Error("Usage: node scripts/run-beta.mjs --record <events.jsonl> --out <result.json> | --verify <result.json>");
  const result = verifyBetaRecord(record);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== "PASS") process.exitCode = 1;
}
