import { NarrationSchema, type Narration } from "./ports.js";
import { CheckResolutionSchema, ResolutionPlanSchema, TurnProposalSchema } from "@third-chair/contracts";
import type { TurnRecord } from "@third-chair/storage";

function signed(value: number): string { return value >= 0 ? `+${value}` : String(value); }

export function renderTerseNarration(turn: TurnRecord): Narration {
  if (turn.directorProposal === null || turn.candidateState === null) throw new Error("TURN_NOT_FINALIZED");
  const proposal = TurnProposalSchema.parse(turn.directorProposal);
  const plan = turn.resolutionPlan === null ? null : ResolutionPlanSchema.parse(turn.resolutionPlan);
  const resolutions = CheckResolutionSchema.array().parse(turn.resolutions ?? [])
    .filter(({ visibility }) => visibility === "PUBLIC");
  const required = proposal.narrativeBrief.requiredResolutionIds.map((id) => {
    const resolution = resolutions.find((item) => item.id === id);
    const check = plan?.checks.find((item) => item.id === id);
    if (!resolution || !check || check.visibility !== "PUBLIC") throw new Error("TERSE_HIDDEN_OR_MISSING_RESOLUTION");
    return `Check ${resolution.id}: d${check.sides} [${resolution.naturalDice.join(", ")}], kept ${resolution.keptDie}, modifier ${signed(resolution.modifier)}, total ${resolution.total} vs DC ${resolution.target} — ${resolution.tier}.`;
  });
  const visibleEventIds = proposal.narrativeBrief.requiredEventIds.filter((id) =>
    turn.candidateState!.events.some((event) => event.id === id && event.audience !== "DIRECTOR"));
  if (visibleEventIds.length !== proposal.narrativeBrief.requiredEventIds.length) throw new Error("TERSE_HIDDEN_OR_MISSING_EVENT");
  return NarrationSchema.parse({
    sceneText: [...required, proposal.narrativeBrief.summary].join("\n"), spokenNpcLines: [],
    mustIncludeResolutionIds: proposal.narrativeBrief.requiredResolutionIds,
    mustIncludeEventIds: proposal.narrativeBrief.requiredEventIds, visibleEventIds,
  });
}
