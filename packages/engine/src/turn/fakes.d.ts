import type { DirectorInput, DirectorPort, Narration, NarratorInput, NarratorPort } from "./ports.js";
import type { TurnProposal } from "@third-chair/contracts";
export declare class FakeDirector implements DirectorPort {
    private readonly handler;
    calls: number;
    constructor(handler: (input: DirectorInput) => TurnProposal | Promise<TurnProposal>);
    propose(input: DirectorInput): Promise<TurnProposal>;
}
export declare class FakeNarrator implements NarratorPort {
    private readonly handler;
    calls: number;
    constructor(handler: (input: NarratorInput) => Narration | Promise<Narration>);
    narrate(input: NarratorInput): Promise<Narration>;
}
export declare class FailureInjector {
    private readonly stage?;
    constructor(stage?: string | undefined);
    check(stage: string): void;
}
//# sourceMappingURL=fakes.d.ts.map