import type { DirectorInput, DirectorPort, DirectorRepairInput, Narration, NarratorInput, NarratorPort } from "./ports.js";
import type { TurnProposal } from "@third-chair/contracts";
export class FakeDirector implements DirectorPort {
  calls = 0;
  repairCalls = 0;
  constructor(
    private readonly handler: (input: DirectorInput) => TurnProposal | Promise<TurnProposal>,
    private readonly repairHandler?: (input: DirectorRepairInput, authoritative: DirectorInput) => TurnProposal | Promise<TurnProposal>,
  ) {}
  propose(input: DirectorInput): Promise<TurnProposal> { this.calls += 1; return Promise.resolve(this.handler(input)); }
  repair(input: DirectorRepairInput, authoritative: DirectorInput): Promise<TurnProposal> {
    this.repairCalls += 1;
    if (!this.repairHandler) return Promise.reject(new Error("DIRECTOR_REPAIR_UNAVAILABLE"));
    return Promise.resolve(this.repairHandler(input, authoritative));
  }
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
