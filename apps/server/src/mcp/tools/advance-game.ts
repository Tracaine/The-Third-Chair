import { IntentAdvanceGameCommandSchema, PlayerViewSchema } from "@third-chair/contracts";
import type { TurnEngine } from "@third-chair/engine";
import { playerResult, type ToolResult } from "../result.js";
export const advanceGameDescriptor = { name: "advance_game", description: "Use this when both required player intents are ready to resolve.", inputSchema: IntentAdvanceGameCommandSchema.shape, outputSchema: PlayerViewSchema.shape, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true } } as const;
export async function advanceGame(deps: { engine: TurnEngine }, input: unknown): Promise<ToolResult> {
  const result = await deps.engine.advanceGame(IntentAdvanceGameCommandSchema.parse(input));
  const payload = { kind: result.kind, lockedIntents: result.turn.lockedIntents, visibleRolls: result.visibleRolls, narration: result.narration, currentStatus: { stateVersion: result.view.stateVersion }, nextDecision: result.view.currentDecision, view: result.view };
  return playerResult(result.kind === "COMMITTED" ? "Turn committed." : "Another turn is already resolving.", payload);
}
