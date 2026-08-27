import { WorldOperationSchema } from "@third-chair/contracts";
const audienceRank = { PUBLIC: 0, PARTY: 1, BILL: 2, RAVEN: 2, DIRECTOR: 3 };
function fail(code) { throw new Error(code); }
export function validateOperation(state, raw, context) {
    const op = WorldOperationSchema.parse(raw);
    if (op.cause.type === "UNCONTESTED") {
        const intent = context.intents.find((candidate) => candidate.actorId === op.cause.intentActorId);
        if (!intent)
            fail("INTENT_AUTHORITY_VIOLATION");
    }
    if (op.cause.type === "RESOLUTION") {
        const result = context.resolutions.find((candidate) => candidate.id === op.cause.resolutionId);
        if (!result)
            fail("UNKNOWN_RESOLUTION");
        if (!op.cause.allowedOutcomeTiers.includes(result.tier))
            fail("OPERATION_OUTCOME_TIER_MISMATCH");
    }
    const actorOperation = "actorId" in op ? state.actors[op.actorId] : undefined;
    if ("actorId" in op && !actorOperation)
        fail("UNKNOWN_ACTOR");
    if (op.cause.type === "UNCONTESTED" && "actorId" in op && op.actorId !== op.cause.intentActorId)
        fail("PLAYER_AUTHORITY_VIOLATION");
    if (op.kind === "SPEND_RESOURCE" || op.kind === "RESTORE_RESOURCE") {
        const resource = state.actors[op.actorId]?.resources[op.resourceId];
        if (!resource)
            fail("UNKNOWN_RESOURCE");
        if (op.kind === "SPEND_RESOURCE" && resource.current < op.amount)
            fail("RESOURCE_UNDERFLOW");
        if (op.kind === "RESTORE_RESOURCE" && resource.current + op.amount > resource.maximum)
            fail("RESOURCE_OVERFLOW");
    }
    if (op.kind === "ADD_EVENT") {
        const intent = op.intentActorId === undefined ? undefined : context.intents.find((candidate) => candidate.actorId === op.intentActorId);
        if (/(dialogue|thought|consent|action)/i.test(op.event.kind) && (!intent || !op.event.text.includes(intent.declaredAction)))
            fail("PLAYER_AUTHORITY_VIOLATION");
    }
    // Operations cannot make a resolution-visible fact more public than its stated audience.
    if (op.cause.type === "RESOLUTION") {
        const resolution = context.resolutions.find((candidate) => candidate.id === op.cause.resolutionId);
        if (resolution.visibility === "SECRET" && audienceRank[op.audience] < audienceRank.DIRECTOR)
            fail("AUDIENCE_MONOTONICITY_VIOLATION");
    }
    return op;
}
//# sourceMappingURL=validate.js.map