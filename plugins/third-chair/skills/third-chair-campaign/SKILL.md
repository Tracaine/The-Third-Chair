---
name: third-chair-campaign
description: Use when starting, creating, listing, resuming, checkpointing, rewinding, exporting, importing, or auditing a Third Chair campaign outside the live action loop.
---

# Third Chair Campaign

Campaign truth comes only from persisted server results. Chat may clarify Bill's request, but never reconstruct actors, inventory, rolls, decisions, checkpoints, or scene history from the transcript.

## Resolve and resume

1. Call `list_campaigns` for the player audience.
2. Select only by returned ID and summary. When multiple campaigns plausibly match, show their distinguishing names, locations, dates, and IDs; ask Bill to choose and stop.
3. Call `get_table_view` for the selected ID. Report campaign and recovery status, then call `render_table` only with the exact returned `playerViewId`.

If list or view fails, stop. A read-only campaign may still be inspected and player-safe exported, but it cannot advance or accept lifecycle mutations.

## Create a two-seat campaign

Prefer quickstart unless Bill explicitly asks for detailed character building. Do not expose source-pack hashes, schemas, setting constants, or a campaign-design questionnaire during quickstart.

Offer Bill these four playable level-one archetypes in plain language:

- **Stalwart Fighter** — armored front-line defender with sword, shield, and Second Wind.
- **Cunning Rogue** — quick, stealthy investigator with rapier and shortbow.
- **Arcane Scholar** — high-elf wizard with utility, defense, and decisive spellcraft.
- **Dawn Cleric** — resilient hill-dwarf healer in scale mail with radiant magic.

Bill chooses only Bill's name and archetype. Foreground Raven chooses and states Raven's own name, archetype, pronouns, and hook independently; never ask Bill to author or approve Raven. Use an evocative campaign name yourself when Bill has not supplied one. Preserve boundaries Bill has already stated, but do not stop the entrance for optional tone, hook, pronoun, or boundary fields.

With both choices locked, call `create_campaign` once using a fresh UUID request ID and `quickstart.billCharacter` plus `quickstart.ravenCharacter`. The server supplies the complete sheets, installed source-pack binding, Dalelands start, and hidden three-route spine. Fetch a fresh table view, render its exact `playerViewId`, present the opening, and move directly into each player's first declared action.

For advanced creation only, gather two complete validated level-one character drafts. Bill owns Bill's draft and Raven owns Raven's. Call the same tool with the advanced `billCharacter` and `ravenCharacter` fields; omit `quickstart`.

## Checkpoint and rewind

For a named checkpoint, fetch a fresh view, ask for a non-empty label, then call `create_checkpoint` with a fresh UUID request ID and that view's `campaignId` and `stateVersion`. Keep the returned checkpoint summary—including ID, label, and target state version—as the authoritative rewind handle.

There is no `list_checkpoints` tool. Rewind only a checkpoint identified by an authoritative `create_checkpoint` result available in the current session or by an explicitly supplied known checkpoint ID. If names or campaigns are ambiguous, ask Bill to choose; never silently choose the newest or closest match.

Before `rewind_to_checkpoint`, present the exact checkpoint label and target state version and explain that the current future will stop being active but remain preserved as an abandoned branch. Ask for explicit confirmation and stop. After Bill confirms, fetch a fresh current view and call the tool with a fresh UUID request ID, the current `expectedStateVersion`, the selected `checkpointId`, and `confirmed: true`. If the current version changed after confirmation, show the new version and confirm again. Refresh and render after success.

## Export and operator-only import

When Bill asks for an export without choosing a mode, use `PLAYER_SAFE` with `confirmedSpoilers: false`. It excludes hidden truth and is not importable.

`FULL_PRIVATE` contains spoiler-bearing Director state, hidden canon, checkpoints, and branch history. Show that warning separately and call it only after explicit confirmation, with `confirmedSpoilers: true`. For either mode, use a fresh view's state version and a fresh UUID request ID, then return the resource link from `export_campaign` and refresh the table.

There is no MCP import tool. Import is an explicitly authorized local operator action for `FULL_PRIVATE` archives only. The operator first dry-runs:

```bash
node scripts/import-saveset.mjs <archive.zip> --database <destination.sqlite> --source-pack <source-pack.sqlite>
```

Only after the archive, exact source-pack hash, and absent destination campaign ID validate may the operator repeat it with `--apply`. Never invent `import_campaign`, import a `PLAYER_SAFE` archive, clone an identity, or attempt import through chat tools.

## Source-pack mismatch

Treat a source-pack hash mismatch as read-only recovery, not missing lore to improvise. Report the mismatch; preserve the campaign and destination unchanged; allow inspection and `PLAYER_SAFE` export only. Recovery is to mount the exact bound pack or follow a separately authorized migration workflow. Never bypass hashes, substitute a plausible pack, or rebuild continuity from chat.

Live in-character action belongs to `third-chair-play`.

## Quick reference

| Request | Required result |
|---|---|
| Ambiguous campaign/checkpoint | Ask Bill to select; make no mutation |
| Create | Bill chooses Bill; Raven chooses Raven; call after both are locked |
| Checkpoint | Fresh view + label + UUID request ID |
| Rewind | Exact target + abandoned-branch warning + explicit confirmation |
| Export | Default `PLAYER_SAFE`; separately warn for `FULL_PRIVATE` |
| Import | Local operator dry-run, then explicit `--apply`; never MCP |
| Hash mismatch | Read-only recovery or authorized migration guidance |

## Common mistakes

- Picking the most recent campaign or checkpoint without resolving ambiguity.
- Rendering before a successful authoritative view.
- Treating a recap as persisted continuity.
- Choosing Bill's character or action for him.
- Rewinding or exporting spoilers from a vague “just do it.”
- Inventing an import or checkpoint-listing MCP tool.
