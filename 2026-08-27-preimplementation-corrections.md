\# Third Chair Pre-Implementation Corrections



\*\*Date:\*\* 2026-08-27  

\*\*Scope:\*\* Targeted corrections from the independent second-pass review. The approved architecture, package order, authority model, source strategy, model-role split, plugin shape, and beta methodology remain unchanged.



\## Exact Changes



| # | Correction | Documents changed | Binding result |

| ---: | --- | --- | --- |

| 1 | One active successor per campaign | Design INV-008 and turn pipeline; portfolio constraints/state machine; CHAIR-001 Tasks 4 and 7 | `active\_turns` is a SQLite-backed campaign reservation with one row per campaign. `beginTurn()` acquires or inspects it under `BEGIN IMMEDIATE`. A different request ID returns `ACTIVE\_SUCCESSOR` and cannot create a sibling plan, resolution, or RNG stream. Restart discovers the reservation. Commit or terminal abandonment releases it atomically. Tests use two database connections and different request IDs. |

| 2 | Code-owned commit metadata | Design pipeline/tests; portfolio constraints/state machine; CHAIR-001 Task 7 | Added `finalizeCandidateForCommit()`. After narration validation and immediately before commit, code stamps `previous + 1` state version, `WorldState.metadata.stateVersion`, applicable turn-number advancement, persisted RNG counter, and next `DecisionRequest.stateVersion`. Director values are ignored. Repository checks and tests require campaign row, state, returned view, and decision to agree. |

| 3 | `FULL\_PRIVATE` identity semantics | Design SaveSet/acceptance; portfolio SaveSet decision; CHAIR-005 Task 5 and beta gate | V1 import is exact restore, not clone. It preserves the original campaign ID, RNG seed/counter, state, turns, checkpoints, branches, lineage, and hashes, and requires that archived ID to be absent from the destination database. The import CLI no longer accepts a replacement campaign ID. Future `CLONE` is explicitly deferred and would rewrite identity-bearing data and change future RNG. |

| 4 | Explicit `AWAITING\_INPUT` recovery command | Design MCP/recovery; portfolio canonical interfaces/state machine; CHAIR-003 Task 7 | `advance\_game` gains a discriminated `NARRATION\_RECOVERY` command containing campaign ID, expected committed state version, stored recovery decision ID, fresh client request ID, unresolved turn ID, and explicit acceptance boolean. It validates the existing reserved candidate, never changes locked inputs/plan/resolutions/candidate, never calls Director or Narrator, never rerolls, and commits the stored candidate once only after acceptance. Foundational `turn\_recovery\_commands` receipts make restart and retries idempotent without adding an eleventh MCP tool. |

| 5 | INV-007 wording | Design INV-007 | Distinguished durable precommit workflow records from authoritative campaign reality. Only finalized campaign state and final turn result commit atomically; persisted plans/resolutions/candidates remain resumable work-in-progress. |

| 6 | Manual dice status | Design manual-dice section | `AWAITING\_ROLLS` and `submit\_rolls` are post-beta extension points, not V1 contracts or statuses. No dead schema was added. |

| 7 | Migration backup protection | Design controls; portfolio constraints; CHAIR-001 Task 4; CHAIR-005 Task 7 | The generic `runMigrationsWithBackup()` primitive now begins in foundational storage work and protects every later file migration. It checkpoints WAL, creates and validates a backup before pending migrations, restores on failure, and uses staged creation for a new database. CHAIR-005 consumes this primitive instead of introducing backup safety after migrations `002` and `003`. |

| 8 | OCR review provenance | Design source-pack schema; portfolio source boundary; CHAIR-002 Tasks 2 and 5 | Added durable `source\_reviews` provenance: chunk ID, reviewer identity, basis, evidence reference, prior/resulting status, and timestamp. Ordinary insertion cannot claim `REVIEWED`; transactional promotion writes the review and status together. Tests cover missing, duplicate, and status-only promotion. |

| 9 | Summary/detail synchronization | Design MCP/Narrator sections; portfolio canonical interfaces | Added the complete ten-tool annotation matrix (`readOnly`, `destructive`, `openWorld`, `idempotent`). Narrator validation now accurately separates deterministic ID/numeric/resource/sentinel/quotation checks from broader semantic agent evaluations. Narration remains unable to mutate state in either layer. |



\## Execution Rulings



\- A rejected terse-rendering recovery terminally abandons only the unresolved successor, releases its active reservation atomically, and leaves committed campaign reality and RNG untouched. This gives the stored recovery decision a defined non-acceptance exit without adding a feature or new public tool.

\- The repository must be initialized with the privacy fence and documentation baseline before the task-level SDD workspace can exist. CHAIR-001 Task 1 therefore verifies the existing fence and commits its implementation on the isolated feature worktree; it does not repeat `git init` inside that worktree.

\- CHAIR-001 exports `AdvanceGameCommandSchema` as an alias of `IntentAdvanceGameCommandSchema`, because Task 8 consumes the stable owning-contract name before CHAIR-003 expands it into the narration-recovery discriminated union.



\## Verification Performed Before Implementation



\- Searched all seven canonical documents for the superseded destination-campaign-ID, implied V1 manual-dice, weak annotation, and undefined recovery wording.

\- Checked Markdown fence balance and required heading presence.

\- Compared every canonical document byte-for-byte with its corrected uploaded-source counterpart after canonicalization.

\- Confirmed that the three PDFs were not modified.

