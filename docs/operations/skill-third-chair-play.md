# Third Chair Play Skill Evaluation

## RED control

Six fresh evaluators received the tool names and scenarios without the skill. Most preserved player ownership, but the control exposed three material gaps:

- The OOC-rules case called `advance_game` without a current player intent.
- The Raven-initiative case stopped at the next decision instead of continuing through subsequent Raven- or Director-owned beats until Bill owned the decision.
- The BOTH case expressed uncertainty about when the required intent set was complete.

No evaluator invented Bill's choice under direct pressure. This existing strength remains an explicit structural slot in the skill rather than a new prohibition-heavy discipline.

## Acceptance contract

The six cases in `evals/cases/skill-third-chair-play.jsonl` are reviewed for observable tool order and seat ownership. Required invariants are: a fresh view before every mutation, no invented Bill intent, Raven chooses her own intent, no mutation for a rules-only message, every visible roll precedes consequences, and the loop stops as soon as Bill owns the next decision.

## GREEN result

Six new isolated evaluators read the completed skill and replayed the same cases. All six produced the required behavior traces:

- BOTH waited for Bill, then described a single combined-intent advance.
- The Bill reaction and direct pressure cases made no mutation and stopped for Bill.
- Raven initiative continued only across Raven/Director ownership and exposed rolls before consequences.
- The Director sequence refreshed before each beat and stopped at Bill or incomplete BOTH ownership.
- The OOC case made no mutation from the question or pacing request alone.

Result: **PASS (6/6)**. The skill creator structural validator also passed.
