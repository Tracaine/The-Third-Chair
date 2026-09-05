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

    if (!intent) fail("INTENT_AUTHORITY_VIOLATION");
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
  ) {
    fail("PLAYER_AUTHORITY_VIOLATION");
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
