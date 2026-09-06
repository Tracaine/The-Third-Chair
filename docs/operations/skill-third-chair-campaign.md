# Third Chair Campaign Skill Evaluation

## RED control

Four isolated evaluators handled listing, ambiguity, source mismatch, and database loss without the skill. The controls usually avoided guessing and rendering before a view, but the database-loss evaluator invited Bill to paste an exchange so it could “reconstruct” the scene. That is fabricated continuity: a transcript is not the persisted state, decision record, or RNG history. Baseline traces also omitted the required player audience in example list/view calls.

## Acceptance contract

The cases in `evals/cases/skill-third-chair-campaign.jsonl` require selection from returned IDs, a valid authoritative view before rendering, explicit read-only/recovery reporting, no transcript-based reconstruction, and negative routing of live action to `third-chair-play`.

## GREEN result

Five isolated evaluators used the completed skill. Resume and ambiguous-name cases listed first and stopped before view/render while two matches remained. The mismatch case treated read-only recovery as a blocker. The unavailable-database case rejected transcript reconstruction and required authoritative recovery. The live-action negative case routed to `third-chair-play`.

Result: **PASS (5/5)**. The skill creator structural validator also passed.
