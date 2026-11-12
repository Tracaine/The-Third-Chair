import {
  WorldOperationSchema,
  type ActorIntent,
  type CheckResolution,
  type WorldOperation,
  type WorldState,
} from "@third-chair/contracts";

export interface OperationContext {
  readonly intents: readonly ActorIntent[];
  readonly resolutions: readonly CheckResolution[];
}

const audienceRank: Record<string, number> = {
  PUBLIC: 0,
  PARTY: 1,
  BILL: 2,
  RAVEN: 2,
  DIRECTOR: 3,
};

function fail(code: string): never {
  throw new Error(code);
}

export function validateOperation(
  state: WorldState,
  raw: WorldOperation,
  context: OperationContext,
): WorldOperation {
  const op = WorldOperationSchema.parse(raw);
  const cause = op.cause;

  if (cause.type === "UNCONTESTED") {
    const intentActorId = cause.intentActorId;
    const intent = context.intents.find(
      (candidate) => candidate.actorId === intentActorId,
    );

    const worldActor = state.actors[intentActorId]?.controller === "DIRECTOR" || state.npcs[intentActorId] !== undefined;
    if (intent?.mode !== "ACT" && !worldActor) fail("INTENT_AUTHORITY_VIOLATION");
  }

  if (cause.type === "RESOLUTION") {
    const resolutionId = cause.resolutionId;
    const result = context.resolutions.find(
      (candidate) => candidate.id === resolutionId,
    );

    if (!result) fail("UNKNOWN_RESOLUTION");

    if (!cause.allowedOutcomeTiers.includes(result.tier)) {
      fail("OPERATION_OUTCOME_TIER_MISMATCH");
    }
  }

  const actorOperation =
    "actorId" in op ? state.actors[op.actorId] : undefined;

  if ("actorId" in op && !actorOperation) {
    fail("UNKNOWN_ACTOR");
  }

  if (
    cause.type === "UNCONTESTED" &&
    "actorId" in op &&
    op.actorId !== cause.intentActorId
    && !(op.kind === "SET_HP" && (state.npcs[cause.intentActorId] || state.actors[cause.intentActorId]?.controller === "DIRECTOR"))
  ) {
    fail("PLAYER_AUTHORITY_VIOLATION");
  }

  if (op.kind === "MOVE_ACTOR") {
    const target = state.locations[op.locationId];
    if (!target || !["PUBLIC", "PARTY"].includes(target.audience)) fail("UNKNOWN_LOCATION");
    if (actorOperation?.controller !== "DIRECTOR" && !context.intents.some((intent) =>
      intent.actorId === op.actorId && intent.mode === "ACT" && intent.targetIds.includes(op.locationId))) fail("PLAYER_AUTHORITY_VIOLATION");
  }
  if (op.kind === "ADD_FACT" || op.kind === "ADD_EVENT" || op.kind === "SET_FLAG" || op.kind === "ADD_LOCATION" || op.kind === "ADD_NPC") {
    const record = op.kind === "ADD_FACT" ? op.fact : op.kind === "ADD_EVENT" ? op.event : op.kind === "SET_FLAG" ? op.flag
      : op.kind === "ADD_LOCATION" ? op.location : op.npc;
    if (record.audience !== op.audience) fail("OPERATION_AUDIENCE_MISMATCH");
    if (op.kind === "ADD_FACT" && state.facts.some(({ id }) => id === op.fact.id)) fail("FACT_ID_ALREADY_EXISTS");
  }
  if (op.kind === "OBSERVE_ENTITY" || op.kind === "DISCOVER_CLUE") {
    if (op.audience === "DIRECTOR" || cause.type === "SYSTEM") fail("DISCOVERY_REQUIRES_OBSERVABLE_CAUSE");
    if (op.kind === "DISCOVER_CLUE") {
      const result = cause.type === "RESOLUTION" ? context.resolutions.find(({ id }) => id === cause.resolutionId) : undefined;
      if (result && !["SUCCESS", "CRITICAL_SUCCESS"].includes(result.tier)) fail("DISCOVERY_CHECK_DID_NOT_SUCCEED");
      const discoverer = cause.type === "UNCONTESTED" ? cause.intentActorId : result?.actorId;
      const seat = discoverer ? state.actors[discoverer]?.controller : undefined;
      if ((op.audience === "BILL" || op.audience === "RAVEN") && seat && seat !== "DIRECTOR" && seat !== op.audience) {
        fail("DISCOVERY_AUDIENCE_MISMATCH");
      }
    }
  }
  if (op.kind === "SET_CAMPAIGN_PROGRESS") {
    const phases = ["OPENING", "DEVELOPMENT", "CLIMAX", "ENDED"];
    const prior = state.campaignProgress?.phase ?? "OPENING";
    if (op.audience !== "PARTY" || phases.indexOf(op.progress.phase) < phases.indexOf(prior)
      || prior === "ENDED" || !op.progress.milestone.trim()) fail("INVALID_CAMPAIGN_PROGRESS");
  }
  if (op.kind === "APPLY_DEATH_SAVE") {
    const roll = cause.type === "RESOLUTION" ? context.resolutions.find(({ id }) => id === cause.resolutionId) : undefined;
    if (!roll || roll.actorId !== op.actorId || roll.key !== "death-save" || roll.visibility !== "PUBLIC"
      || actorOperation?.currentHp !== 0 || actorOperation.deathSaves.successes === 3 || actorOperation.deathSaves.failures === 3) {
      fail("INVALID_DEATH_SAVE");
    }
  }
  if (op.kind === "CAST_SPELL") {
    const intent = context.intents.find((item) => item.actorId === op.actorId && item.mode === "ACT");
    const casting = actorOperation?.mechanics?.spellcasting;
    const level = actorOperation?.mechanics?.ancestryCantrip?.id === op.spellId ? 0 : casting?.spellLevels?.[op.spellId];
    if (!intent?.committedResourceIds.includes(op.spellId) || !actorOperation?.spells.includes(op.spellId) || level === undefined) {
      fail("SPELL_NOT_AUTHORIZED");
    }
    if (level > 0 && !actorOperation.spellSlots?.[String(level)]?.current) fail("SPELL_SLOT_UNAVAILABLE");
  }

  if (op.kind === "SPEND_RESOURCE" || op.kind === "RESTORE_RESOURCE") {
    const resource = state.actors[op.actorId]?.resources[op.resourceId];

    if (!resource) fail("UNKNOWN_RESOURCE");

    if (op.kind === "SPEND_RESOURCE" && resource.current < op.amount) {
      fail("RESOURCE_UNDERFLOW");
    }

    if (
      op.kind === "RESTORE_RESOURCE" &&
      resource.current + op.amount > resource.maximum
    ) {
      fail("RESOURCE_OVERFLOW");
    }
  }

  if (op.kind === "ADD_EVENT") {
    const intent =
      op.intentActorId == null
        ? undefined
        : context.intents.find(
            (candidate) => candidate.actorId === op.intentActorId,
          );

    const declaredAction = intent?.declaredAction;

    if (
      /(dialogue|thought|consent|action)/i.test(op.event.kind) &&
      (
        declaredAction === undefined ||
        !op.event.text.includes(declaredAction)
      )
    ) {
      fail("PLAYER_AUTHORITY_VIOLATION");
    }
  }

  if (cause.type === "RESOLUTION") {
    const resolutionId = cause.resolutionId;
    const resolution = context.resolutions.find(
      (candidate) => candidate.id === resolutionId,
    );

    if (!resolution) fail("UNKNOWN_RESOLUTION");

    if (
      resolution.visibility === "SECRET" &&
      audienceRank[op.audience] < audienceRank.DIRECTOR
    ) {
      fail("AUDIENCE_MONOTONICITY_VIOLATION");
    }
  }

  return op;
}
