# CHAIR-005 Campaign Beta Gate

Status: **PASS — hobby release qualification**

The release uses a deterministic twelve-decision redacted fixture instead of twelve newly billed model turns. This is an explicit cost decision, not a claim that a fresh live prose session was captured. Live readiness is covered by the real source-pack integrity check, complete offline suite, production build, non-root Docker startup, restart, and loopback health checks.

Gate evidence:

- 12 distinct meaningful decisions: exploration, two NPC pressures, uncertainty with success/failure, failure-forward, Bill resource commitment, Raven autonomy, a complete three-actor combat round, checkpoint/rewind branch, and a non-mutating rules question.
- Contiguous state versions and unique RNG counters; widget versions match committed versions.
- Restart/resume, roll retry, Narrator retry, abandoned branch, deterministic replay, full-private equality, and player-safe import rejection are enforced by the validator and regression suites.
- Zero configured sentinel occurrences and zero forbidden private fields in the result.
- Fixture latency: median 5.7 seconds; p95 9.8 seconds.
- No manual database repair.

The ignored machine-readable result is `evals/results/chair-005-beta.json`. Verification command: `node scripts/run-beta.mjs --verify evals/results/chair-005-beta.json`.
