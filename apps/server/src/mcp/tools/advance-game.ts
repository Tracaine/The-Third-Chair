import { AdvanceGameCommandSchema, PlayerViewSchema } from "@third-chair/contracts";
import type { TurnEngine } from "@third-chair/engine";
import { playerResult, type ToolResult } from "../result.js";
export const advanceGameDescriptor = { name: "advance_game", description: "Submit the required player intents, or answer an outstanding narration-recovery decision.", inputSchema: AdvanceGameCommandSchema, outputSchema: PlayerViewSchema.shape, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true } } as const;
export async function advanceGame(deps: { engine: TurnEngine }, input: unknown): Promise<ToolResult> {
  const result = await deps.engine.advanceGame(AdvanceGameCommandSchema.parse(input));
  const payload = { kind: result.kind, lockedIntents: result.turn.lockedIntents, visibleRolls: result.visibleRolls, narration: result.narration, currentStatus: { stateVersion: result.view.stateVersion }, nextDecision: result.view.currentDecision, view: result.view };
  const message = result.kind === "COMMITTED" ? "Turn committed."
    : result.kind === "AWAITING_INPUT" ? "Turn is awaiting narration recovery."
      : result.kind === "RECOVERY_REJECTED" ? "Narration recovery rejected."
        : "Another turn is already resolving.";
  return playerResult(message, payload);
}
