import { type AdvanceGameCommand, type CheckResolution } from "@third-chair/contracts";
import type { CampaignRepository, TurnRecord, TurnRepository } from "@third-chair/storage";
import { projectPlayerView } from "../projection/player-view.js";
import { type DirectorPort, type NarratorPort } from "./ports.js";
export interface AdvanceGameResult {
    readonly kind: "COMMITTED" | "ACTIVE_SUCCESSOR";
    readonly turn: TurnRecord;
    readonly view: ReturnType<typeof projectPlayerView>;
    readonly visibleRolls: readonly CheckResolution[];
    readonly narration: unknown;
}
export interface TurnEngineDeps {
    readonly campaigns: CampaignRepository;
    readonly turns: TurnRepository;
    readonly director: DirectorPort;
    readonly narrator: NarratorPort;
    readonly newTurnId?: () => string;
    readonly failureInjector?: {
        check(stage: string): void;
    };
}
export interface TurnEngine {
    advanceGame(command: AdvanceGameCommand): Promise<AdvanceGameResult>;
}
export declare function createTurnEngine(deps: TurnEngineDeps): TurnEngine;
//# sourceMappingURL=turn-engine.d.ts.map