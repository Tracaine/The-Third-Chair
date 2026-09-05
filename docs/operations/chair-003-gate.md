# CHAIR-003 Live Runtime Gate

Gate date: 2026-09-05

Branch: `chair-003-live-runtime`

Status: **offline gate passed; real-model gate pending**

## Delivered runtime

- A bounded structured Director with four private retrieval tools and one engine-owned lock-and-resolve tool.
- Immutable resolution plans, deterministic SQLite-owned dice, exact retry/restart reuse, and no-roll turns.
- One proposal repair attempt with no reroll or commit before candidate validation.
- A separate structured Narrator with zero tools and no hidden `WorldState`.
- Deterministic validation for required visible IDs, exact roll/resource facts, sentinel leakage, and quoted player lines.
- Two identical-candidate narration attempts followed by a persisted Bill-owned decision to accept terse deterministic rendering or abandon the successor.
- Recovery acceptance/rejection receipts that survive restart and never invoke either model or consume RNG.
- Live server selection of real adapters when fake mode is disabled.
- A redacted four-path real-model evaluator.

## Offline evidence

- `npm run verify:private`: PASS
- `npm test`: PASS — 49 files / 254 tests
- `npm run typecheck`: PASS — all six workspaces plus evaluator
- `npm run build`: PASS
- `git diff --check`: PASS
- Private source-pack database: present, ignored, and uncommitted
- Private database SHA-256: `0544cbd10b6320986994a46d37f555698b9a932b9ff2d676834a5ec6a3ad0dbf`
- Private database size: 14,004,224 bytes

## Real-model evidence required before tag

Run `npm run eval` with locally configured OpenAI API access and the verified private database. All four cases must pass:

1. Safe action commits with no roll and no RNG consumption.
2. Meaningful uncertainty locks stakes before a persisted roll.
3. Two forced narration failures retain the roll and return Bill-owned recovery.
4. Restart after persisted dice commits with the identical stored dice.

The evaluator writes only redacted aggregate evidence to ignored `evals/results/latest.json`. It never writes prompts, narration, source passages, hidden state, raw model output, traces, or credentials.

## Scope amendment

This private two-player checkpoint uses the approved lean four-path gate instead of the original twelve-case adversarial matrix. Production multi-tenant hardening, fuzzing, and broad semantic narration grading were deliberately deferred; core player-agency, truth-authority, privacy, deterministic dice, and restart invariants remain enforced.
