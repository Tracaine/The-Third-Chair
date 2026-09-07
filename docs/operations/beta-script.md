# Chair 005 beta gate

The gate consumes redacted decision events and rejects missing coverage, version or RNG gaps, no-op progress, sentinel leakage, manual database repair, absent restart/rewind evidence, or unverified SaveSet recovery.

Generate the local ignored qualification record and verify it:

```powershell
node scripts/run-beta.mjs --record evals/cases/chair-005-beta.jsonl --out evals/results/chair-005-beta.json
node scripts/run-beta.mjs --verify evals/results/chair-005-beta.json
```

Only hashes, stable IDs, modes, ownership, version/counter transitions, latency, and PASS/FAIL evidence belong in the record. Never add dialogue, narration, hidden facts, source text, prompts, keys, or file paths.

The committed fixture is the deterministic release qualification. A later real-play capture may use the same event shape and validator without changing the gate contract.
