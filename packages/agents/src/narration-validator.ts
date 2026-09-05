import type { Narration } from "@third-chair/engine";
import type { NarratorInput } from "./context/narrator-context.js";

function sameIds(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((id, index) => id === expected[index])
    && new Set(actual).size === actual.length;
}

function signed(value: number): string { return value >= 0 ? `+${value}` : String(value); }

export function requiredResolutionBlock(input: NarratorInput, resolutionId: string): string {
  const resolution = input.persistedResolutions.find(({ id }) => id === resolutionId);
  const check = input.persistedPlan?.checks.find(({ id }) => id === resolutionId);
  if (!resolution || !check) throw new Error("NARRATION_MISSING_VISIBLE_RESOLUTION");
  return `Check ${resolution.id}: d${check.sides} [${resolution.naturalDice.join(", ")}], kept ${resolution.keptDie}, modifier ${signed(resolution.modifier)}, total ${resolution.total} vs DC ${resolution.target} — ${resolution.tier}.`;
}

export function validateNarration(narration: Narration, input: NarratorInput): void {
  const requiredResolutions = input.narrativeBrief.requiredResolutionIds;
  const requiredEvents = input.narrativeBrief.requiredEventIds;
  if (!sameIds(narration.mustIncludeResolutionIds, requiredResolutions)
    || !sameIds(narration.mustIncludeEventIds, requiredEvents)
    || requiredEvents.some((id) => narration.visibleEventIds.filter((candidate) => candidate === id).length !== 1)) {
    throw new Error("NARRATION_VALIDATION_FAILED");
  }
  const prefix = requiredResolutions.map((id) => requiredResolutionBlock(input, id)).join("\n");
  if (prefix.length > 0 && !narration.sceneText.startsWith(prefix)) throw new Error("NARRATION_VALIDATION_FAILED");

  const allText = [narration.sceneText, ...narration.spokenNpcLines].join("\n");
  if (/SENTINEL/i.test(allText)) throw new Error("NARRATION_VALIDATION_FAILED");

  const allowedPlayerLines = new Set(input.lockedIntents.flatMap((intent) =>
    [intent.declaredAction, intent.desiredOutcome, intent.approach, intent.contingency]
      .filter((value): value is string => value !== undefined)));
  for (const match of narration.sceneText.matchAll(/["“]([^"”]+)["”]/g)) {
    if (!allowedPlayerLines.has(match[1]!)) throw new Error("NARRATION_VALIDATION_FAILED");
  }

  for (const operation of input.visibleOperations) {
    if (operation.kind !== "SPEND_RESOURCE" && operation.kind !== "RESTORE_RESOURCE") continue;
    const sign = operation.kind === "SPEND_RESOURCE" ? "-" : "+";
    if (!narration.sceneText.includes(`Resource ${operation.resourceId}: ${sign}${operation.amount}, now ${operation.current}.`)) {
      throw new Error("NARRATION_VALIDATION_FAILED");
    }
  }
}
