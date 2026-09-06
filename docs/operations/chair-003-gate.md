# CHAIR-003 Live Runtime Gate

**Status:** PASS

**Date:** 2026-09-06

**Branch:** `chair-003-live-runtime`

## Delivered runtime

- A bounded structured Director with four private retrieval tools and one engine-owned lock-and-resolve tool.
- Immutable resolution plans, deterministic SQLite-owned dice, exact retry/restart reuse, and true no-roll turns.
- One bounded proposal-repair attempt with persisted dice reused and no commit before candidate validation.
- A separate structured Narrator with zero tools and no hidden `WorldState`.
- Deterministic validation for player authority, resolution/result IDs, visible facts, and narration boundaries.
- Two identical-candidate narration attempts followed by a persisted Bill-owned terse-rendering recovery decision.
- Restart-safe recovery receipts that never invoke a model or consume RNG after Bill chooses deterministic terse rendering.
- Live server selection of real adapters when fake mode is disabled, with tracing off during normal play.

SQLite, deterministic resolution, validation, projection, and commit remain the only authorities.

## Real-model evidence

Both roles used `gpt-5.6-sol`. Director used high reasoning and low text verbosity; Narrator used medium reasoning. Parallel tool calls and normal-play tracing were disabled. The verified private source-pack database was opened read-only.

The combined live run evaluated remote commit `24a046b8a549815dca6e13d6c21252f90499959d`. The subsequent final-review change exposes the already-tested narration-recovery command through the MCP parser and descriptor; it does not change the Director, Narrator, engine, storage, dice, or evaluator paths.

| Case | Result | Final kind | Rolls | Latency |
| --- | --- | --- | ---: | ---: |
| `no-roll-safe-action` | PASS | `COMMITTED` | 0 | 22,299 ms |
| `stakes-before-roll` | PASS | `COMMITTED` | 1 | 63,473 ms |
| `narration-failure-after-roll` | PASS | `AWAITING_INPUT` | 1 | 27,801 ms |
| `restart-after-persisted-dice` | PASS | `COMMITTED` | 1 | 55,322 ms |

- Median latency: 41,561.5 ms.
- Nearest-rank p95 latency: 63,473 ms.
- The check-bearing run exceeded the original 60-second Director allowance after its die persisted. The bounded default was raised to 90 seconds within the existing 120-second maximum; model, reasoning, tool, validation, and authority settings were unchanged.
- The aspirational median-under-20-seconds and p95-under-45-seconds deployment targets were not met. No additional agents were introduced; latency remains an explicit optimization item for later integration work.

## Recovery state evidence

| Case | Before state SHA-256 | After state SHA-256 | Meaning |
| --- | --- | --- | --- |
| Narration failure | `dd7b84877205d4d8d15683f2e3b498cf7eb1fd866fe9a839ef59684beada2720` | `dd7b84877205d4d8d15683f2e3b498cf7eb1fd866fe9a839ef59684beada2720` | Failed narration changed no committed campaign truth. |
| Restart after persisted dice | `d6a200f4ed08089fab02b2d84b0b21d5b48fb12fc7922f44a89d2beef91f5651` | `aadd1cda9fdb600f0f344990ce704787019733b4ab827c6d10e15f731174a876` | The stored resolved successor committed after restart. |

The restart grader also compared the natural dice stored before interruption with those stored after resume. They were identical and the final turn contained exactly one resolution.

## Offline evidence

| Command | Outcome |
| --- | --- |
| `npm run verify:private` | PASS |
| `npm run typecheck` | PASS; all six workspaces plus evaluator |
| `npm test` | PASS; 53 files / 281 tests |
| `npm run build` | PASS |
| `git diff --check` | PASS |

- Private source-pack database SHA-256: `0544cbd10b6320986994a46d37f555698b9a932b9ff2d676834a5ec6a3ad0dbf`.
- Private source-pack database size: 14,004,224 bytes.
- The database, source PDFs, extracted material, raw model output, prompts, narration, hidden state, traces, and credentials remain excluded from Git.

The bounded whole-branch review found no other blocking correctness, privacy, authority, restart, or tracing issue after the public narration-recovery command boundary was restored and verified.

## Scope amendment

This private two-player checkpoint uses the approved lean four-path gate instead of the original twelve-case adversarial matrix. Production multi-tenant hardening, fuzzing, and broad semantic narration grading were deliberately deferred. Core player-agency, truth-authority, privacy, deterministic-dice, narration-failure, and restart invariants remain enforced and passed.
