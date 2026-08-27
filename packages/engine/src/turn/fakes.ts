import type { DirectorInput, DirectorPort, Narration, NarratorInput, NarratorPort } from "./ports.js";
import type { TurnProposal } from "@third-chair/contracts";
export class FakeDirector implements DirectorPort {
  calls = 0;
  constructor(private readonly handler: (input: DirectorInput) => TurnProposal | Promise<TurnProposal>) {}
  propose(input: DirectorInput): Promise<TurnProposal> { this.calls += 1; return Promise.resolve(this.handler(input)); }
}
export class FakeNarrator implements NarratorPort {
  calls = 0;
  constructor(private readonly handler: (input: NarratorInput) => Narration | Promise<Narration>) {}
  narrate(input: NarratorInput): Promise<Narration> { this.calls += 1; return Promise.resolve(this.handler(input)); }
}
export class FailureInjector {
  constructor(private readonly stage?: string) {}
  check(stage: string): void { if (this.stage === stage) throw new Error(`INJECTED_FAILURE:${stage}`); }
}
