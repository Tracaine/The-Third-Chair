---
name: third-chair-campaign
description: Use when listing, resuming, inspecting, or auditing a Third Chair campaign outside the live action loop.
---

# Third Chair Campaign

Resume only from persisted campaign truth. A chat transcript may help identify what Bill means, but it cannot reconstruct or replace SQLite state.

## Resume and audit

1. Call `list_campaigns` for Bill's player audience.
2. Resolve the selection only from returned campaign IDs and summaries. If multiple results plausibly match, show the distinguishing names, locations, dates, and IDs; ask Bill to choose and stop.
3. Call `get_table_view` with the selected `campaignId` and audience. Do not claim the campaign is resumed until this succeeds.
4. Report the returned campaign status and the view's recovery status. If the campaign is read-only or recovery is required, state the blocker plainly and do not imply live play can advance.
5. Call `render_table` only with the exact `playerViewId` from that valid view, plus the same campaign ID and audience.

If list or view retrieval is unavailable, stop. Do not rebuild actors, inventory, rolls, decisions, or scene history from conversation memory—even if Bill offers a recap. Recover the database or authoritative checkpoint instead.

## Capability boundary

At CHAIR-004, this skill can list, select, inspect, audit, and render. Campaign creation, checkpoints, rewind, and export are unavailable until the connected server advertises those tools. Do not simulate them from chat or filesystem guesses.

Live in-character actions belong to `third-chair-play`, not this skill.

## Quick reference

| Condition | Result |
|---|---|
| One clear campaign | Fetch its authoritative view |
| Ambiguous match | Ask Bill to select by returned ID |
| Read-only or recovery | Report status; do not advance |
| Database unavailable | Stop; never reconstruct truth |

## Common mistakes

- Picking the most recent campaign without resolving ambiguity.
- Rendering before a successful fresh view.
- Treating a plausible recap as persisted continuity.
- Promising CHAIR-005 management operations early.
