import { readFileSync } from "node:fs";
import { WorldStateSchema } from "@third-chair/contracts";

export function stateForCase(name: string) {
  const state = WorldStateSchema.parse(JSON.parse(readFileSync(
    new URL("./fixtures/chair-003-state.json", import.meta.url), "utf8",
  )));
  const safe = name.replaceAll("-", "_");
  state.metadata.campaignId = `test_eval_campaign_${safe}`;
  state.metadata.sceneId = `test_eval_scene_${safe}`;
  state.currentDecision.id = `test_eval_decision_${safe}`;

  if (name === "no-roll-safe-action") {
    state.locations.test_eval_room!.status = "An ordinary wooden door is visibly unlocked, unobstructed, and opens freely.";
    state.currentDecision.situation = "An ordinary wooden door is visibly unlocked and unobstructed; nothing opposes opening it.";
  }
  return WorldStateSchema.parse(state);
}
